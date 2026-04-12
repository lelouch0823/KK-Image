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
  if (checkActive && product.status !== 'active') {
    throw new BadRequestError('product must be active');
  }

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
