import { DomainOutboxPublisher } from '../../../services/DomainOutboxPublisher.js';
import { DomainOutboxDispatchService } from '../../../services/DomainOutboxDispatchService.js';
import { getDomainEventDefinition } from '../../../services/DomainEventCatalog.js';
import { runOutboxPoller } from '../../../api/cron/outbox.js';

const DEFAULT_OUTBOX_BACKLOG_THRESHOLD = 8;

function shouldPollImmediately(eventType) {
  const normalized = String(eventType || '');
  if (
    normalized.startsWith('order_')
    || normalized.startsWith('purchase_order_')
    || normalized.startsWith('purchase_receipt_')
    || normalized === 'order_pending_reminder_due'
    || normalized === 'order_deadline_reminder_due'
    || normalized === 'notification_read_by_admin'
    || normalized === 'notification_read_by_sales'
  ) {
    return true;
  }

  try {
    const definition = getDomainEventDefinition(normalized);
    return definition.consumers.includes('notification')
      || definition.consumers.includes('webhook')
      || (definition.consumers.length === 1 && definition.consumers[0] === 'cache');
  } catch {
    return false;
  }
}

async function shouldSchedulePoller(c, sourceEvents = [], publishedEvents = [], options = {}) {
  const pollerMode = options.pollerMode || 'auto';
  if (pollerMode === 'never') return false;
  if (pollerMode === 'always') return true;

  const eventCatalog = Array.isArray(sourceEvents) && sourceEvents.length > 0
    ? sourceEvents
    : publishedEvents;
  if ((eventCatalog || []).some((event) => shouldPollImmediately(event?.event_type))) {
    return true;
  }

  if (typeof c?.env?.DB?.prepare !== 'function' || typeof c?.env?.DB?.batch !== 'function') {
    return false;
  }

  try {
    const dispatchService = new DomainOutboxDispatchService(c.env.DB);
    const backlog = await dispatchService.countAvailableJobs();
    return backlog >= Number(options.backlogThreshold || DEFAULT_OUTBOX_BACKLOG_THRESHOLD);
  } catch {
    return false;
  }
}

export async function publishDomainEventsAndPoll(c, events = [], workerId = 'domain-outbox', publishOptions = undefined) {
  if (!Array.isArray(events) || events.length === 0) return [];

  const publisher = new DomainOutboxPublisher(c.env.DB);
  const publishedEvents = await publisher.publish(events, publishOptions);

  if (await shouldSchedulePoller(c, events, publishedEvents, publishOptions)) {
    c.executionCtx.waitUntil(runOutboxPoller({
      env: c.env,
      requestUrl: c.req.url,
      workerId,
    }));
  }

  return publishedEvents;
}

export async function publishSingleDomainEventAndPoll(c, event, workerId = null, publishOptions = undefined) {
  if (!event) return [];
  const resolvedWorkerId = workerId || `${event.event_type}:${event.aggregate_id || 'event'}`;
  return publishDomainEventsAndPoll(c, [event], resolvedWorkerId, publishOptions);
}
