interface OrderConstraints {
  moq?: unknown;
  orderStep?: unknown;
  packSize?: unknown;
}

function normalizePositiveInt(value: unknown, fallback: number = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function getSuggestedOrderQuantity(requestedQty: unknown, constraints: OrderConstraints = {}): number {
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

export function validateOrderQuantity(quantity: unknown, constraints: OrderConstraints = {}): { valid: boolean; reason: string; suggestedQuantity: number } {
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

/** 将值转为有限数字，非有限时返回 fallback */
export function normalizeDecimal(value: unknown, fallback: number = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** 将值转为有限数字或 null（空值返回 null） */
export function normalizeNullableDecimal(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/** 将值转为非负整数（收货数量专用） */
export function normalizeReceiptQty(value: unknown): number {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.trunc(numeric));
}
