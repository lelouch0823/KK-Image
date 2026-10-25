import { BadRequestError } from '../../lib/hono/errors.js';
import { normalizeProductCurrency } from './currency.js';

const REQUIRED_VARIANT_FIELDS = [
  'price',
  'cost_price',
  'stock_quantity',
  'alert_threshold',
  'status',
];
const VALID_VARIANT_STATUSES = new Set(['active', 'archived']);

const isEmptyValue = (value) => value === undefined || value === null || value === '';

function assertNonNegativeNumber(value, message) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new BadRequestError(message);
  }
}

export function validateProductPayload(
  payload = {},
  {
    requireVariants = false,
    allowExistingVariantStockOmission = false,
    allowGeneratedVariantSku = false,
  } = {}
) {
  const normalized = { ...payload };

  if (normalized.currency !== undefined) {
    const normalizedCurrency = normalizeProductCurrency(normalized.currency);
    if (!normalizedCurrency) {
      throw new BadRequestError('Invalid currency code');
    }
    normalized.currency = normalizedCurrency;
  }

  if (requireVariants || normalized.variants !== undefined) {
    if (!Array.isArray(normalized.variants) || normalized.variants.length === 0) {
      throw new BadRequestError('At least one variant is required');
    }

    normalized.variants.forEach((variant, index) => {
      if (!variant || typeof variant !== 'object') {
        throw new BadRequestError(`Variant #${index + 1} is invalid`);
      }

      // R2（审查发现 2）：已有变体（带 id）不允许通过目录编辑/导入直改库存——
      // 库存的唯一变更入口是盘点/收货/履约等带台账的业务事件，直接改写会
      // 与 inventory_ledger 背离且在并发出入库下丢失变动
      if (
        allowExistingVariantStockOmission &&
        String(variant.id || '').trim() &&
        variant.stock_quantity !== undefined
      ) {
        throw new BadRequestError(
          `Variant #${index + 1}: 已有变体库存请通过盘点/库存调整变更，不允许直接改写`
        );
      }

      for (const field of REQUIRED_VARIANT_FIELDS) {
        if (
          field === 'stock_quantity' &&
          allowExistingVariantStockOmission &&
          String(variant.id || '').trim() &&
          variant.stock_quantity === undefined
        ) {
          continue;
        }
        if (isEmptyValue(variant[field])) {
          throw new BadRequestError(`Variant #${index + 1} missing required field: ${field}`);
        }
      }

      const canGenerateSku = allowGeneratedVariantSku && !String(variant.id || '').trim();

      if (String(variant.sku || '').trim() === '' && !canGenerateSku) {
        throw new BadRequestError(`Variant #${index + 1} missing required field: sku`);
      }
      assertNonNegativeNumber(variant.price, `Variant #${index + 1} price must be non-negative`);
      assertNonNegativeNumber(
        variant.cost_price,
        `Variant #${index + 1} cost_price must be non-negative`
      );
      if (
        !(
          allowExistingVariantStockOmission &&
          String(variant.id || '').trim() &&
          variant.stock_quantity === undefined
        )
      ) {
        assertNonNegativeNumber(
          variant.stock_quantity,
          `Variant #${index + 1} stock_quantity must be non-negative`
        );
      }
      assertNonNegativeNumber(
        variant.alert_threshold,
        `Variant #${index + 1} alert_threshold must be non-negative`
      );

      if (!VALID_VARIANT_STATUSES.has(String(variant.status || '').trim())) {
        throw new BadRequestError(`Variant #${index + 1} has invalid status`);
      }
    });
  }

  return normalized;
}
