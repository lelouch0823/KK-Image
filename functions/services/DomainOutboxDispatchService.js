export class DomainOutboxDispatchService {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.leaseMs = deps.leaseMs || 30_000;
    this.retryBackoffMs = deps.retryBackoffMs || ((attemptCount) => Math.min(attemptCount * 5_000, 60_000));
  }

  async claimJobs(consumerName, workerId, nowTs = this.now(), limit = 10) {
    const { results } = await this.db
      .prepare(
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
             (jobs.status IN ('pending', 'failed') AND jobs.available_at <= ?)
             OR (jobs.status = 'processing' AND COALESCE(jobs.leased_until, 0) < ?)
           )
         ORDER BY jobs.available_at ASC, jobs.created_at ASC
         LIMIT ?`
      )
      .bind(consumerName, nowTs, nowTs, limit)
      .all();

    const candidates = results || [];
    if (candidates.length === 0) return [];

    const leasedUntil = nowTs + this.leaseMs;
    const statements = candidates.map((job) => this.db
      .prepare(
        `UPDATE outbox_consumer_jobs
         SET status = 'processing',
             leased_by = ?,
             leased_until = ?,
             updated_at = ?
         WHERE id = ?
           AND consumer_name = ?
           AND (
             (status IN ('pending', 'failed') AND available_at <= ?)
             OR (status = 'processing' AND COALESCE(leased_until, 0) < ?)
           )`
      )
      .bind(workerId, leasedUntil, nowTs, job.id, consumerName, nowTs, nowTs));

    const claimResults = await this.db.batch(statements);

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
    return this.db
      .prepare(
        `UPDATE outbox_consumer_jobs
         SET status = 'published',
             processed_at = ?,
             leased_by = NULL,
             leased_until = NULL,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(nowTs, nowTs, jobId)
      .run();
  }

  async markFailed(job, error, nowTs = this.now()) {
    const attemptCount = Number(job?.attempt_count || 0) + 1;
    const nextAvailableAt = nowTs + this.retryBackoffMs(attemptCount);

    return this.db
      .prepare(
        `UPDATE outbox_consumer_jobs
         SET status = 'failed',
             available_at = ?,
             last_error = ?,
             attempt_count = ?,
             leased_by = NULL,
             leased_until = NULL,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        nextAvailableAt,
        String(error?.message || error || 'unknown outbox consumer error'),
        attemptCount,
        nowTs,
        job?.id
      )
      .run();
  }
}
