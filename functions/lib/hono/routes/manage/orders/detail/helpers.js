import { validateProductVariantBinding } from '../../../../../../api/utils/validation.js';
import { canTransitionOrderStatus } from '../../../../../../api/utils/order-state-machine.js';
import { BadRequestError } from '../../../../errors.js';
import { assertForceStatusTransitionAllowed } from '../authz-helpers.js';
import { buildOrderBindingSnapshot } from '../../../../../../api/utils/order-binding-snapshot.js';
import { runOutboxPoller } from '../../../../../../api/cron/outbox.js';

export const ADMIN_EDITABLE_FIELDS = [
  'status',
  'name',
  'brand',
  'category',
  'series',
  'sku',
  'size',
  'color',
  'material',
  'remark',
  'deadline',
  'quantity',
  'lines',
];

export const STRUCTURAL_EDITABLE_STATUSES = new Set(['pending', 'rejected', 'void']);
export const QUANTITY_EDITABLE_STATUSES = new Set(['pending', 'confirmed', 'rejected', 'void']);
export const ARCHIVED_ORDER_MUTATION_MESSAGE = '订单已归档，请先恢复后再修改';
export const ORDER_BOUND_SNAPSHOT_FIELDS = Object.freeze([
  'name',
  'brand',
  'category',
  'series',
  'sku',
  'size',
  'color',
  'material',
]);

export function normalizeLineText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

export function normalizeLineQuantity(value, fallback = 1) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

export function normalizeEditableLines(lines = []) {
  return lines.map((line) => ({
    name: normalizeLineText(line.name ?? line.productName),
    brand: normalizeLineText(line.brand),
    category: normalizeLineText(line.category),
    series: normalizeLineText(line.series),
    sku: normalizeLineText(line.sku),
    size: normalizeLineText(line.size),
    color: normalizeLineText(line.color),
    material: normalizeLineText(line.material),
    remark: normalizeLineText(line.remark),
    deadline: normalizeLineText(line.deadline),
    quantity: normalizeLineQuantity(line.quantity ?? line.orderedQuantity),
    productId: line.productId ?? null,
    variantId: line.variantId ?? null,
  }));
}

export async function hydrateEditableLines(db, lines = []) {
  const hydratedLines = [];
  for (const line of normalizeEditableLines(lines)) {
    const binding = await validateProductVariantBinding(
      db,
      line.productId || null,
      line.variantId ?? null,
      { checkActive: true }
    );
    const boundSnapshot = buildOrderBindingSnapshot({
      product: binding.product,
      variant: binding.variant,
      fallback: line,
    });
    hydratedLines.push({
      ...line,
      name: boundSnapshot.name,
      brand: boundSnapshot.brand,
      category: boundSnapshot.category,
      series: boundSnapshot.series,
      sku: boundSnapshot.sku,
      size: boundSnapshot.size,
      color: boundSnapshot.color,
      material: boundSnapshot.material,
      productId: binding.normalizedProductId,
      variantId: binding.normalizedVariantId,
    });
  }
  return hydratedLines;
}

export function getAdminActor(user) {
  return {
    id: user?.id || 'admin',
    name: user?.name || 'Admin',
  };
}

export function assertOrderIsActiveForMutation(order) {
  if (order?.archivedAt || order?.archived_at) {
    throw new BadRequestError(ARCHIVED_ORDER_MUTATION_MESSAGE);
  }
}

export async function assertStatusTransitionAllowed({
  c,
  user,
  fromStatus,
  toStatus,
  forceStatusTransition,
  reason,
}) {
  if (toStatus === undefined || toStatus === fromStatus) return;
  if (canTransitionOrderStatus(fromStatus, toStatus)) return;
  if (!forceStatusTransition) {
    throw new BadRequestError(`Invalid status transition: ${fromStatus} -> ${toStatus}`);
  }
  await assertForceStatusTransitionAllowed(c, user, reason);
}

export function scheduleOutboxProcessing(c, workerId) {
  c.executionCtx.waitUntil(
    runOutboxPoller({
      env: c.env,
      requestUrl: c.req.url,
      workerId,
    })
  );
}
