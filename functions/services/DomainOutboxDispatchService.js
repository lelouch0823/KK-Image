import { executeBatchChunks } from '../lib/db/batch.js';
import { execute, query, queryFirst } from '../lib/db/query.js';

// 单个任务的最大重试次数：超过后不再自动认领（保持 failed 状态供人工排查/重放），
// 防止永久失败的消费者（如持续 5xx 的 webhook 端点）以 60 秒退避无限重试
export const OUTBOX_MAX_ATTEMPTS = 20;

export class DomainOutboxDispatchService {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.leaseMs = deps.leaseMs || 30_000;
    this.retryBackoffMs =
      deps.retryBackoffMs || ((attemptCount) => Math.min(attemptCount * 5_000, 60_000));
  }

  async claimJobs(consumerName, workerId, nowTs = this.now(), limit = 10) {
    const { results } = await query(
      this.db,
      `SELECT
            jobs.*,
            evt.command_id,
            evt.event_type,
            evt.aggregate_type,
            evt.aggregate_id,
            evt.correlation_id,
            evt.causation_id,
            evt.payload_json
         FROM outbox_consumer_jobs jobs
         JOIN domain_outbox evt ON evt.id = jobs.event_id
         WHERE jobs.consumer_name = ?
           AND (
             (jobs.status = 'pending' AND jobs.available_at <= ?)
             OR (jobs.status = 'failed' AND jobs.available_at <= ? AND jobs.attempt_count < ${OUTBOX_MAX_ATTEMPTS})
             OR (jobs.status = 'processing' AND COALESCE(jobs.leased_until, 0) < ?)
           )
         ORDER BY jobs.available_at ASC, jobs.created_at ASC
         LIMIT ?`,
      [consumerName, nowTs, nowTs, nowTs, limit],
      { label: 'outbox.claimJobs.select' }
    );

    const candidates = results || [];
    if (candidates.length === 0) return [];

    const leasedUntil = nowTs + this.leaseMs;
    const statements = candidates.map((job) =>
      this.db
        .prepare(
          `UPDATE outbox_consumer_jobs
         SET status = 'processing',
             leased_by = ?,
             leased_until = ?,
             updated_at = ?
         WHERE id = ?
           AND consumer_name = ?
           AND (
             (status = 'pending' AND available_at <= ?)
             OR (status = 'failed' AND available_at <= ? AND attempt_count < ${OUTBOX_MAX_ATTEMPTS})
             OR (status = 'processing' AND COALESCE(leased_until, 0) < ?)
           )`
        )
        .bind(workerId, leasedUntil, nowTs, job.id, consumerName, nowTs, nowTs, nowTs)
    );

    const claimResults = await executeBatchChunks(this.db, statements);

    return candidates
      .filter((_, index) => (claimResults?.[index]?.meta?.changes || 0) === 1)
      .map((job) => ({
        ...job,
        status: 'processing',
        leased_by: workerId,
        leased_until: leasedUntil,
      }));
  }

  async markPublished(jobId, nowTs = this.now()) {
    return execute(
      this.db,
      `UPDATE outbox_consumer_jobs
         SET status = 'published',
             processed_at = ?,
             leased_by = NULL,
             leased_until = NULL,
             updated_at = ?
         WHERE id = ?`,
      [nowTs, nowTs, jobId],
      { label: 'outbox.markPublished' }
    );
  }

  async markFailed(job, error, nowTs = this.now()) {
    const attemptCount = Number(job?.attempt_count || 0) + 1;
    const nextAvailableAt = nowTs + this.retryBackoffMs(attemptCount);
    const errorMessage = String(error?.message || error || 'unknown outbox consumer error');

    // B-L4：任务耗尽全部重试（进入死信）时写入管理员通知，
    // 避免持续失败的投递静默丢失，只能靠 7 天保留期销毁证据
    if (attemptCount >= OUTBOX_MAX_ATTEMPTS) {
      try {
        await this.notifyDeadLetter(job, errorMessage);
      } catch (notifyError) {
        console.error('[outbox] dead-letter notification failed:', notifyError);
      }
    }

    return execute(
      this.db,
      `UPDATE outbox_consumer_jobs
         SET status = 'failed',
             available_at = ?,
             last_error = ?,
             attempt_count = ?,
             leased_by = NULL,
             leased_until = NULL,
             updated_at = ?
         WHERE id = ?`,
      [nextAvailableAt, errorMessage, attemptCount, nowTs, job?.id],
      { label: 'outbox.markFailed' }
    );
  }

  /**
   * 死信告警：写入 notifications 表（admin 收件箱），带 dedupeKey 幂等
   * @private
   */
  async notifyDeadLetter(job, errorMessage) {
    if (!this.db || typeof this.db.prepare !== 'function') return;
    const { NotificationRepository } = await import('../repositories/NotificationRepository.js');
    const notificationRepo = new NotificationRepository(this.db);
    await notificationRepo.createFromDomainEvent({
      receiver: 'admin',
      type: 'system',
      title: 'Outbox 任务投递失败（已耗尽重试）',
      content: `事件 ${job?.event_type || job?.event_id || 'unknown'} 消费任务 ${job?.consumer_name || ''} 在 ${OUTBOX_MAX_ATTEMPTS} 次尝试后失败：${errorMessage}`.slice(0, 500),
      sourceConsumer: 'outbox',
      sourceEventId: job?.event_id || job?.id || null,
      dedupeKey: `outbox_dead_letter:${job?.id || 'unknown'}`,
    });
  }

  async countAvailableJobs(nowTs = this.now()) {
    const row = await queryFirst(
      this.db,
      `SELECT COUNT(*) AS total
         FROM outbox_consumer_jobs
         WHERE (status = 'pending' AND available_at <= ?)
            OR (status = 'failed' AND available_at <= ? AND attempt_count < ${OUTBOX_MAX_ATTEMPTS})
            OR (status = 'processing' AND COALESCE(leased_until, 0) < ?)`,
      [nowTs, nowTs, nowTs],
      { label: 'outbox.countAvailableJobs' }
    );

    return Number(row?.total || 0);
  }
}
