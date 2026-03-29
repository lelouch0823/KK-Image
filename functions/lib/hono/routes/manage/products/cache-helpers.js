import { publishSingleDomainEventAndPoll } from '../../../_shared/domain-outbox.js';

export async function scheduleProductCacheInvalidation(c, { eventType = 'product_updated', productIds = [] } = {}) {
  const normalizedProductIds = [...new Set((productIds || []).filter(Boolean))];
  const primaryProductId = normalizedProductIds.length === 1 ? normalizedProductIds[0] : null;

  await publishSingleDomainEventAndPoll(c, {
    event_type: eventType,
    aggregate_type: 'product',
    aggregate_id: primaryProductId || normalizedProductIds[0] || 'products',
    payload: {
      product_id: primaryProductId,
      product_ids: normalizedProductIds,
    },
  }, `${eventType}:${primaryProductId || normalizedProductIds[0] || 'products'}`);
}
