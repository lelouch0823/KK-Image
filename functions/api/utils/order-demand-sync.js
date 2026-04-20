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

function normalizeProductId(productId) {
  return productId || null;
}

function normalizeOrderLineId(orderLineId) {
  return orderLineId || null;
}

function normalizeDemandLine(line = {}, index = 0) {
  const variantId = normalizeVariantId(line.variantId ?? line.variant_id);
  if (!variantId) return null;

  return {
    key:
      normalizeOrderLineId(line.id ?? line.orderLineId ?? line.order_line_id) ||
      `${variantId}:${normalizeProductId(line.productId ?? line.product_id) || 'unbound'}:${index}`,
    orderLineId: normalizeOrderLineId(line.id ?? line.orderLineId ?? line.order_line_id),
    productId: normalizeProductId(line.productId ?? line.product_id),
    variantId,
    quantity: normalizeQuantity(line.quantity ?? line.orderedQuantity ?? line.ordered_qty),
  };
}

function normalizeDemandLines(lines = [], fallback = {}) {
  const normalizedLines = Array.isArray(lines)
    ? lines
        .map((line, index) => normalizeDemandLine(line, index))
        .filter(Boolean)
    : [];

  if (normalizedLines.length > 0) return normalizedLines;

  const fallbackVariantId = normalizeVariantId(fallback.variantId);
  if (!fallbackVariantId) return [];

  return [
    {
      key: normalizeOrderLineId(fallback.orderLineId) || 'fallback',
      orderLineId: normalizeOrderLineId(fallback.orderLineId),
      productId: normalizeProductId(fallback.productId),
      variantId: fallbackVariantId,
      quantity: normalizeQuantity(fallback.quantity),
    },
  ];
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

export function buildOrderDemandSyncTransitionsByLines({
  orderId,
  previousStatus,
  nextStatus,
  previousLines = [],
  nextLines = [],
  previousFallback = {},
  nextFallback = {},
}) {
  const previousDemandLines = normalizeDemandLines(previousLines, previousFallback);
  const nextDemandLines = normalizeDemandLines(nextLines, nextFallback);

  if (previousDemandLines.length === 0 && nextDemandLines.length === 0) {
    return buildOrderDemandSyncTransitions({
      orderId,
      previousStatus,
      nextStatus,
      previousQuantity: previousFallback.quantity,
      nextQuantity: nextFallback.quantity,
      previousVariantId: previousFallback.variantId,
      nextVariantId: nextFallback.variantId,
    }).filter((transition) => Boolean(transition.variantId));
  }

  const previousByKey = new Map(previousDemandLines.map((line) => [line.key, line]));
  const nextByKey = new Map(nextDemandLines.map((line) => [line.key, line]));
  const allKeys = [...new Set([...previousByKey.keys(), ...nextByKey.keys()])];
  const transitions = [];

  for (const key of allKeys) {
    const previousLine = previousByKey.get(key) || null;
    const nextLine = nextByKey.get(key) || null;
    const lineTransitions = buildOrderDemandSyncTransitions({
      orderId,
      previousStatus,
      nextStatus,
      previousQuantity: previousLine?.quantity ?? 0,
      nextQuantity: nextLine?.quantity ?? 0,
      previousVariantId: previousLine?.variantId ?? null,
      nextVariantId: nextLine?.variantId ?? null,
    });

    for (const transition of lineTransitions) {
      if (!transition.variantId) continue;
      transitions.push({
        ...transition,
        orderLineId: nextLine?.orderLineId ?? previousLine?.orderLineId ?? null,
        productId: nextLine?.productId ?? previousLine?.productId ?? null,
      });
    }
  }

  return transitions;
}

export async function syncOrderDemandTransitions(demandService, payload) {
  const transitions = buildOrderDemandSyncTransitions(payload);
  for (const transition of transitions) {
    await demandService.syncOrderTransition(transition);
  }
  return transitions;
}

export async function syncOrderDemandTransitionsByLines(demandService, payload) {
  const transitions = buildOrderDemandSyncTransitionsByLines(payload);
  for (const transition of transitions) {
    await demandService.syncOrderTransition(transition);
  }
  return transitions;
}
