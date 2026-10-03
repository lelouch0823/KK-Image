import { ProductRepository } from '../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../repositories/ProductDimensionRepository.js';
import { BadRequestError } from '../../lib/hono/errors.js';

export async function validateProductVariantBinding(db, productId, variantId, options = {}) {
  const {
    checkActive = false,
    checkExistence = true,
    variantSelectPolicy = 'allow_out_of_stock',
  } = options;
  const normalizedProductId = productId || null;
  const normalizedVariantId = variantId || null;

  if (normalizedProductId && !normalizedVariantId) {
    throw new BadRequestError('variantId is required when productId is provided');
  }
  if (!normalizedProductId && normalizedVariantId) {
    throw new BadRequestError('productId is required when variantId is provided');
  }
  if (!normalizedProductId && !normalizedVariantId) {
    return {
      product: null,
      variant: null,
      normalizedProductId,
      normalizedVariantId: null,
    };
  }

  if (!checkExistence) {
    return {
      product: null,
      variant: null,
      normalizedProductId,
      normalizedVariantId,
    };
  }

  const productRepo = new ProductRepository(db);
  const product = await productRepo.findById(normalizedProductId);
  if (!product) {
    throw new BadRequestError('productId does not exist');
  }
  // products 表自迁移 0043 起不再包含 status 列，产品状态由变体级别管理

  const variantRepo = new ProductVariantRepository(db);
  const variant = await variantRepo.findByIdAndProductId(normalizedVariantId, normalizedProductId);
  if (!variant) {
    throw new BadRequestError('variantId does not belong to productId');
  }
  if (checkActive && variant.status !== 'active') {
    throw new BadRequestError('variant must be active');
  }
  if (variantSelectPolicy === 'in_stock_only') {
    const availableQuantity = Number(
      variant.available_quantity ??
        variant.available ??
        variant.stock_quantity ??
        variant.stockQuantity ??
        0
    );
    if (availableQuantity <= 0) {
      throw new BadRequestError('variant must be in stock');
    }
  }

  let hydratedProduct = product;
  if (!hydratedProduct.dimension_map) {
    const dimensionRepo = new ProductDimensionRepository(db);
    hydratedProduct = {
      ...product,
      dimension_map: await dimensionRepo.getDimensionMap(normalizedProductId),
    };
  }

  return {
    product: hydratedProduct,
    variant,
    normalizedProductId,
    normalizedVariantId,
  };
}


/**
 * 批量校验产品-变体绑定（性能审查 P-M1）。
 *
 * 订单创建/编辑逐行调用 validateProductVariantBinding 会产生 2N+2 次
 * 串行 D1 往返；本函数按 productId/variantId 去重后用 2 条 IN 查询
 * 批量取回，内存中逐对校验，语义与单条版本完全一致（错误消息相同）。
 *
 * @param {D1Database} db
 * @param {Array<{productId: string|null, variantId: string|null}>} bindings
 * @param {Object} options - 与 validateProductVariantBinding 一致
 * @returns {Promise<Array>} 与入参顺序一致的结果数组
 */
export async function validateProductVariantBindingsBatch(db, bindings = [], options = {}) {
  const { checkActive = false, checkExistence = true, variantSelectPolicy = 'allow_out_of_stock' } = options;

  const normalized = bindings.map((binding = {}) => ({
    productId: binding.productId || null,
    variantId: binding.variantId ?? null,
  }));

  // 逐对做与单条版本相同的形状校验（不落库的规则先行）
  for (const { productId, variantId } of normalized) {
    if (productId && !variantId) {
      throw new BadRequestError('variantId is required when productId is provided');
    }
    if (!productId && variantId) {
      throw new BadRequestError('productId is required when variantId is provided');
    }
  }

  const uniquePairs = [
    ...new Map(
      normalized
        .filter(({ productId, variantId }) => productId && variantId)
        .map(({ productId, variantId }) => [`${productId}:${variantId}`, { productId, variantId }])
    ).values(),
  ];

  let productMap = new Map();
  let variantMap = new Map();
  let hydratedProducts = new Map();

  if (checkExistence && uniquePairs.length > 0) {
    const productIds = [...new Set(uniquePairs.map(({ productId }) => productId))];
    const variantIds = [...new Set(uniquePairs.map(({ variantId }) => variantId))];

    const productPlaceholders = productIds.map(() => '?').join(', ');
    const { results: productRows } = await db
      .prepare(`SELECT * FROM products WHERE id IN (${productPlaceholders})`)
      .bind(...productIds)
      .all();
    productMap = new Map((productRows || []).map((row) => [row.id, row]));

    const variantPlaceholders = variantIds.map(() => '?').join(', ');
    const { results: variantRows } = await db
      .prepare(
        `SELECT pv.*, COALESCE(ib.available, COALESCE(ib.on_hand, pv.stock_quantity, 0)) AS available_quantity
         FROM product_variants pv
         LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
         WHERE pv.id IN (${variantPlaceholders})`
      )
      .bind(...variantIds)
      .all();
    variantMap = new Map((variantRows || []).map((row) => [row.id, row]));

    // 维度映射按产品批量补齐（缺失 dimension_map 的产品）
    const missingDimensionIds = productIds.filter(
      (id) => productMap.has(id) && !productMap.get(id).dimension_map
    );
    if (missingDimensionIds.length > 0) {
      const dimensionRepo = new ProductDimensionRepository(db);
      const values = await Promise.all(
        missingDimensionIds.map(async (id) => [id, await dimensionRepo.getDimensionMap(id)])
      );
      hydratedProducts = new Map(values);
    }
  }

  return normalized.map(({ productId, variantId }) => {
    if (!productId && !variantId) {
      return { product: null, variant: null, normalizedProductId: null, normalizedVariantId: null };
    }

    if (!checkExistence) {
      return { product: null, variant: null, normalizedProductId: productId, normalizedVariantId: variantId };
    }

    const product = productMap.get(productId);
    if (!product) {
      throw new BadRequestError('productId does not exist');
    }

    const variant = variantMap.get(variantId);
    if (!variant || variant.product_id !== productId) {
      throw new BadRequestError('variantId does not belong to productId');
    }
    if (checkActive && variant.status !== 'active') {
      throw new BadRequestError('variant must be active');
    }
    if (variantSelectPolicy === 'in_stock_only') {
      const availableQuantity = Number(
        variant.available_quantity ?? variant.available ?? variant.stock_quantity ?? variant.stockQuantity ?? 0
      );
      if (availableQuantity <= 0) {
        throw new BadRequestError('variant must be in stock');
      }
    }

    const hydratedProduct = hydratedProducts.has(productId)
      ? { ...product, dimension_map: hydratedProducts.get(productId) }
      : product;

    return {
      product: hydratedProduct,
      variant,
      normalizedProductId: productId,
      normalizedVariantId: variantId,
    };
  });
}
