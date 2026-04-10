const DEMAND_ACTIVE_STATUSES = new Set(['confirmed', 'production', 'shipping', 'arrived']);

function normalizeStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized || null;
}

function normalizeQuantity(quantity) {
  return Math.max(0, Number(quantity) || 0);
}

function normalizeVariantId(variantId) {
  return variantId || null;
}

export function buildOrderDemandSyncTransitions({
  orderId,
  previousStatus,
  nextStatus,
  previousQuantity,
  nextQuantity,
  previousVariantId,
  nextVariantId,
}) {
  const normalizedPreviousStatus = normalizeStatus(previousStatus);
  const normalizedNextStatus = normalizeStatus(nextStatus);
  const normalizedPreviousQuantity = normalizeQuantity(previousQuantity);
  const normalizedNextQuantity = normalizeQuantity(nextQuantity);
  const normalizedPreviousVariantId = normalizeVariantId(previousVariantId);
  const normalizedNextVariantId = normalizeVariantId(nextVariantId);

  const projectionChanged =
    normalizedPreviousVariantId !== normalizedNextVariantId ||
    normalizedPreviousQuantity !== normalizedNextQuantity;
  const previousProjectionActive =
    DEMAND_ACTIVE_STATUSES.has(normalizedPreviousStatus) && Boolean(normalizedPreviousVariantId);
  const nextProjectionActive =
    DEMAND_ACTIVE_STATUSES.has(normalizedNextStatus) && Boolean(normalizedNextVariantId);

  if (projectionChanged && (previousProjectionActive || nextProjectionActive)) {
    return [
      {
        orderId,
        fromStatus: normalizedPreviousStatus,
        toStatus: 'void',
        quantity: normalizedPreviousQuantity,
        variantId: normalizedPreviousVariantId,
      },
      {
        orderId,
        fromStatus: null,
        toStatus: normalizedNextStatus,
        quantity: normalizedNextQuantity,
        variantId: normalizedNextVariantId,
      },
    ];
  }

  return [
    {
      orderId,
      fromStatus: normalizedPreviousStatus,
      toStatus: normalizedNextStatus,
      quantity: normalizedNextQuantity,
      variantId: normalizedNextVariantId,
    },
  ];
}

export async function syncOrderDemandTransitions(demandService, payload) {
  const transitions = buildOrderDemandSyncTransitions(payload);
  for (const transition of transitions) {
    await demandService.syncOrderTransition(transition);
  }
  return transitions;
}
