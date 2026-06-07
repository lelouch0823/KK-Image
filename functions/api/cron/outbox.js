import { success, error } from '../utils/response.js';
import { isCronAuthorized } from '../utils/cron-auth.js';
import { DomainOutboxDispatchService } from '../../services/DomainOutboxDispatchService.js';
import { DOMAIN_OUTBOX_CONSUMERS } from '../../services/DomainOutboxConsumers.js';
import { runConcurrent } from '../../lib/async/runConcurrent.js';
import { OutboxRuntimeStateRepository } from '../../repositories/OutboxRuntimeStateRepository.js';

const ACTIVE_CONSUMERS = ['audit', 'cache', 'notification', 'webhook'];
const DEFAULT_JOB_CONCURRENCY = 4;
const DEFAULT_MAX_ROUNDS = 4;
const DEFAULT_CLAIM_BATCH_SIZE = 50;
const REQUEST_JOB_CONCURRENCY = 1;
const REQUEST_MAX_ROUNDS = 1;
const REQUEST_CLAIM_BATCH_SIZE = 10;

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
