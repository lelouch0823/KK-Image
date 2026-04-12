import { DomainOutboxPublisher } from '../../../services/DomainOutboxPublisher.js';
import { runOutboxPoller } from '../../../api/cron/outbox.js';

export async function publishDomainEventsAndPoll(c, events = [], workerId = 'domain-outbox', publishOptions = undefined) {
  if (!Array.isArray(events) || events.length === 0) return [];

  const publisher = new DomainOutboxPublisher(c.env.DB);
  const publishedEvents = await publisher.publish(events, publishOptions);

  c.executionCtx.waitUntil(runOutboxPoller({
    env: c.env,
    requestUrl: c.req.url,
    workerId,
  }));

  return publishedEvents;
}

export async function publishSingleDomainEventAndPoll(c, event, workerId = null, publishOptions = undefined) {
  if (!event) return [];
  const resolvedWorkerId = workerId || `${event.event_type}:${event.aggregate_id || 'event'}`;
  return publishDomainEventsAndPoll(c, [event], resolvedWorkerId, publishOptions);
}
