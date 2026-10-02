import { success, error } from '../utils/response.js';
import { isCronAuthorized } from '../utils/cron-auth.js';
import {
  DomainOutboxDispatchService,
  OUTBOX_MAX_ATTEMPTS,
} from '../../services/DomainOutboxDispatchService.js';
import { DOMAIN_OUTBOX_CONSUMERS } from '../../services/DomainOutboxConsumers.js';
import { runConcurrent } from '../../lib/async/runConcurrent.js';
import { OutboxRuntimeStateRepository } from '../../repositories/OutboxRuntimeStateRepository.js';

// emailNotify 消费者已在 DomainEventCatalog 中为订单类事件注册：
// 邮件未配置（EMAIL_ENABLED 关闭）时 EmailService 会优雅降级为 no-op
const ACTIVE_CONSUMERS = ['audit', 'cache', 'notification', 'webhook', 'emailNotify'];
const DEFAULT_JOB_CONCURRENCY = 4;
const DEFAULT_MAX_ROUNDS = 4;
const DEFAULT_CLAIM_BATCH_SIZE = 50;
const REQUEST_JOB_CONCURRENCY = 1;
const REQUEST_MAX_ROUNDS = 1;
const REQUEST_CLAIM_BATCH_SIZE = 10;

// ── 保留策略 ────────────────────────────────────────────────
// 已发布任务与陈旧失败任务定期清理，防止 outbox_consumer_jobs / domain_outbox
// 随写操作无限增长（每个事件产生 1 + N 消费者行）。AI 请求遥测同样按期清理。
const OUTBOX_RETENTION_DAYS = 7;
const AI_TRACE_RETENTION_DAYS = 30;
// 请求路径触发的轮询按概率执行清理，避免每次写操作都付出 DELETE 代价
const REQUEST_PATH_CLEANUP_PROBABILITY = 0.02;

async function runOutboxRetentionCleanup(db, nowTs) {
  const outboxCutoff = nowTs - OUTBOX_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const traceCutoff = nowTs - AI_TRACE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  // 1) 已发布任务：保留 7 天后删除
  // 2) 已达重试上限的失败任务：同样按期清理（保留策略见 DomainOutboxDispatchService）
  const jobsDeleted = await db
    .prepare(
      `DELETE FROM outbox_consumer_jobs
       WHERE (status = 'published' AND processed_at IS NOT NULL AND processed_at < ?)
          OR (status = 'failed' AND attempt_count >= ${OUTBOX_MAX_ATTEMPTS} AND updated_at < ?)`
    )
    .bind(outboxCutoff, outboxCutoff)
    .run();

  // 3) 无剩余消费者任务的事件本体（jobs 表对 event 有 ON DELETE CASCADE，反之不会）
  const eventsDeleted = await db
    .prepare(
      `DELETE FROM domain_outbox
       WHERE created_at < ?
         AND NOT EXISTS (
           SELECT 1 FROM outbox_consumer_jobs j WHERE j.event_id = domain_outbox.id
         )`
    )
    .bind(outboxCutoff)
    .run();

  // 4) AI 请求遥测（30 天）与其 span
  await db
    .prepare('DELETE FROM ai_request_spans WHERE created_at < ?')
    .bind(traceCutoff)
    .run();
  const tracesDeleted = await db
    .prepare('DELETE FROM ai_request_traces WHERE created_at < ?')
    .bind(traceCutoff)
    .run();

  const jobsCount = Number(jobsDeleted?.meta?.changes || 0);
  const eventsCount = Number(eventsDeleted?.meta?.changes || 0);
  if (jobsCount + eventsCount > 0) {
    console.log(
      `[OutboxRetention] removed ${jobsCount} consumer jobs, ${eventsCount} events (cutoff=${outboxCutoff})`
    );
  }
  return {
    jobsDeleted: jobsCount,
    eventsDeleted: eventsCount,
    aiTracesDeleted: Number(tracesDeleted?.meta?.changes || 0),
  };
}

async function processOutboxJob({
  consumerName,
  job,
  env,
  baseUrl,
  dispatchService,
  nowTs,
  state,
}) {
  try {
    const consumer = DOMAIN_OUTBOX_CONSUMERS[consumerName];
    if (typeof consumer !== 'function') {
      throw new Error(`unknown outbox consumer: ${consumerName}`);
    }

    await consumer({
      db: env.DB,
      env,
      event: {
        id: job.id,
        event_id: job.event_id,
        event_type: job.event_type,
        aggregate_type: job.aggregate_type,
        aggregate_id: job.aggregate_id,
        correlation_id: job.correlation_id,
        causation_id: job.causation_id,
        payload_json: job.payload_json,
      },
      job,
      baseUrl,
      state,
    });

    await dispatchService.markPublished(job.id, nowTs);
    return { published: 1, failed: 0 };
  } catch (jobError) {
    await dispatchService.markFailed(job, jobError, nowTs);
    return { published: 0, failed: 1 };
  }
}

export async function runOutboxPoller({
  env,
  requestUrl,
  workerId = null,
  nowTs = Date.now(),
  jobConcurrency = undefined,
  maxRounds = undefined,
  claimBatchSize = undefined,
  minRunIntervalMs = undefined,
  force = undefined,
}) {
  const isRequestPathRun = workerId != null;
  const resolvedForce = force ?? false;
  const resolvedJobConcurrency =
    jobConcurrency ?? (isRequestPathRun ? REQUEST_JOB_CONCURRENCY : DEFAULT_JOB_CONCURRENCY);
  const resolvedMaxRounds =
    maxRounds ?? (isRequestPathRun ? REQUEST_MAX_ROUNDS : DEFAULT_MAX_ROUNDS);
  const resolvedClaimBatchSize =
    claimBatchSize ?? (isRequestPathRun ? REQUEST_CLAIM_BATCH_SIZE : DEFAULT_CLAIM_BATCH_SIZE);
  const resolvedMinRunIntervalMs = minRunIntervalMs ?? (isRequestPathRun ? 0 : undefined);
  const dispatchService = new DomainOutboxDispatchService(env.DB);
  const runtimeStateRepo = new OutboxRuntimeStateRepository(env.DB);
  const baseUrl = new URL(requestUrl).origin;
  const resolvedWorkerId = workerId || `cron:${nowTs}`;
  const lease = await runtimeStateRepo.tryAcquire({
    workerId: resolvedWorkerId,
    nowTs,
    force: resolvedForce,
    ...(resolvedMinRunIntervalMs === undefined
      ? {}
      : { minRunIntervalMs: resolvedMinRunIntervalMs }),
  });

  const consumerStats = Object.fromEntries(
    ACTIVE_CONSUMERS.map((consumerName) => [
      consumerName,
      {
        claimed: 0,
        published: 0,
        failed: 0,
      },
    ])
  );

  if (!lease) {
    return {
      claimed: 0,
      published: 0,
      failed: 0,
      rounds: 0,
      skipped: true,
      backlog: null,
      consumers: consumerStats,
    };
  }

  let rounds = 0;
  let claimedCount = 0;
  let publishedCount = 0;
  let failedCount = 0;
  const state = {
    env,
    invalidatedUrls: new Set(),
    allSalesTokens: null,
    salesTokensById: new Map(),
    refreshedReadModels: new Set(),
    readModelRefreshes: new Map(),
    services: {},
  };

  try {
    while (rounds < resolvedMaxRounds) {
      let roundClaimedCount = 0;

      for (const consumerName of ACTIVE_CONSUMERS) {
        const jobs = await dispatchService.claimJobs(
          consumerName,
          resolvedWorkerId,
          nowTs,
          resolvedClaimBatchSize
        );
        claimedCount += jobs.length;
        roundClaimedCount += jobs.length;
        consumerStats[consumerName].claimed += jobs.length;
        const outcomes = await runConcurrent(
          jobs,
          (job) =>
            processOutboxJob({ consumerName, job, env, baseUrl, dispatchService, nowTs, state }),
          resolvedJobConcurrency
        );
        const consumerPublished = outcomes.reduce(
          (sum, outcome) => sum + Number(outcome?.published || 0),
          0
        );
        const consumerFailed = outcomes.reduce(
          (sum, outcome) => sum + Number(outcome?.failed || 0),
          0
        );
        publishedCount += consumerPublished;
        failedCount += consumerFailed;
        consumerStats[consumerName].published += consumerPublished;
        consumerStats[consumerName].failed += consumerFailed;
      }

      if (roundClaimedCount === 0) {
        break;
      }

      rounds += 1;
    }

    // 保留策略清理：cron 路径每次执行；请求路径按低概率执行（避免热路径 DELETE 开销）。
    // 清理是尽力而为的维护任务，失败不中断轮询主流程
    let retention = null;
    if (!isRequestPathRun || Math.random() < REQUEST_PATH_CLEANUP_PROBABILITY) {
      try {
        retention = await runOutboxRetentionCleanup(env.DB, nowTs);
      } catch (cleanupError) {
        console.error('[OutboxRetention] Cleanup failed:', cleanupError?.message || cleanupError);
      }
    }

    const backlog = await dispatchService.countAvailableJobs(nowTs);
    await runtimeStateRepo.finishLease({
      scope: lease.scope,
      leaseToken: lease.leaseToken,
      nowTs,
      claimed: claimedCount,
      published: publishedCount,
      failed: failedCount,
      backlog,
      rounds,
    });

    return {
      claimed: claimedCount,
      published: publishedCount,
      failed: failedCount,
      rounds,
      skipped: false,
      backlog,
      consumers: consumerStats,
      ...(retention && { retention }),
    };
  } catch (error) {
    await runtimeStateRepo.finishLease({
      scope: lease.scope,
      leaseToken: lease.leaseToken,
      nowTs,
      claimed: claimedCount,
      published: publishedCount,
      failed: failedCount,
      backlog: null,
      rounds,
    });
    throw error;
  }
}

export async function onRequest(context) {
  const { env, request } = context;

  if (!isCronAuthorized(request, env)) {
    return error('Unauthorized', 401);
  }

  try {
    const result = await runOutboxPoller({
      env,
      requestUrl: request.url,
    });

    return success(result, 'Outbox poller completed');
  } catch (err) {
    return error(`Cron Outbox Failed: ${err.message}`, 500);
  }
}
