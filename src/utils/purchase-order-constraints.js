function normalizePositiveInt(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function getSuggestedOrderQuantity(requestedQty, constraints = {}) {
  const moq = normalizePositiveInt(constraints.moq, 1);
  const orderStep = normalizePositiveInt(constraints.orderStep, 1);
  const packSize = normalizePositiveInt(constraints.packSize, 1);
  const start = Math.max(normalizePositiveInt(requestedQty, 1), moq);

  for (let qty = start; qty <= start + 50000; qty += 1) {
    if (qty >= moq && (qty - moq) % orderStep === 0 && qty % packSize === 0) {
      return qty;
    }
  }
  return start;
}

export function validateOrderQuantity(quantity, constraints = {}) {
  const moq = normalizePositiveInt(constraints.moq, 1);
  const orderStep = normalizePositiveInt(constraints.orderStep, 1);
  const packSize = normalizePositiveInt(constraints.packSize, 1);
  const qty = normalizePositiveInt(quantity, 1);

  const valid = qty >= moq && (qty - moq) % orderStep === 0 && qty % packSize === 0;
  if (valid) return { valid: true, reason: '', suggestedQuantity: qty };

  return {
    valid: false,
    reason: '数量不满足 MOQ/步长/箱规 约束',
    suggestedQuantity: getSuggestedOrderQuantity(qty, { moq, orderStep, packSize }),
  };
}

