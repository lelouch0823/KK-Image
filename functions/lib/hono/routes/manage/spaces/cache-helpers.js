import { publishSingleDomainEventAndPoll } from '../../../_shared/domain-outbox.js';

export async function invalidateSpaceCaches(c, options = {}) {
  const aggregateId = options.spaceId || options.parentId || 'spaces';
  await publishSingleDomainEventAndPoll(
    c,
    {
      event_type: options.eventType || 'space_updated',
      aggregate_type: 'space',
      aggregate_id: aggregateId,
      payload: {
        space_id: options.spaceId || null,
        parent_id: options.parentId || null,
        product_ids: [...new Set((options.productIds || []).filter(Boolean))],
      },
    },
    `${options.eventType || 'space_updated'}:${aggregateId}`
  );
}
