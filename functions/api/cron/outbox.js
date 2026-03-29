import { success, error } from '../utils/response.js';
import { isCronAuthorized } from '../utils/cron-auth.js';
import { DomainOutboxDispatchService } from '../../services/DomainOutboxDispatchService.js';
import { DOMAIN_OUTBOX_CONSUMERS } from '../../services/DomainOutboxConsumers.js';

const ACTIVE_CONSUMERS = ['audit', 'cache', 'notification', 'webhook'];

export async function runOutboxPoller({ env, requestUrl, workerId = null, nowTs = Date.now() }) {
  const dispatchService = new DomainOutboxDispatchService(env.DB);
  const baseUrl = new URL(requestUrl).origin;
  const resolvedWorkerId = workerId || `cron:${nowTs}`;

  let claimedCount = 0;
  let publishedCount = 0;
  let failedCount = 0;

  for (const consumerName of ACTIVE_CONSUMERS) {
    const jobs = await dispatchService.claimJobs(consumerName, resolvedWorkerId, nowTs, 25);
    claimedCount += jobs.length;

    for (const job of jobs) {
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
        });

        await dispatchService.markPublished(job.id, nowTs);
        publishedCount += 1;
      } catch (jobError) {
        await dispatchService.markFailed(job, jobError, nowTs);
        failedCount += 1;
      }
    }
  }

  return {
    claimed: claimedCount,
    published: publishedCount,
    failed: failedCount,
  };
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
