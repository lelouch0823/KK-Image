import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../../../../../repositories/ProductDimensionRepository.js';
import { VariantImageRepository } from '../../../../../repositories/VariantImageRepository.js';
import { resolveVariantImageSyncPlan } from './variant-image-sync.js';
import { archiveVariantImagesByFolder } from './variant-image-folders.js';
import { normalizeProductCurrency } from './currency.js';
import { BadRequestError, ConflictError } from '../../../errors.js';
import { scheduleProductCacheInvalidation } from './cache-helpers.js';
import { normalizeVariantDimensionKeys, normalizeVariantExternalCodes } from './variant-normalizers.js';

const REQUIRED_VARIANT_FIELDS = ['price', 'cost_price', 'stock_quantity', 'alert_threshold', 'status'];
const isEmptyValue = (value) => value === undefined || value === null || value === '';

function validateVariants(variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new BadRequestError('At least one variant is required');
  }

  for (const [index, variant] of variants.entries()) {
    if (!variant || typeof variant !== 'object') {
      throw new BadRequestError(`Variant #${index + 1} is invalid`);
    }
    for (const field of REQUIRED_VARIANT_FIELDS) {
      if (isEmptyValue(variant[field])) {
        throw new BadRequestError(`Variant #${index + 1} missing required field: ${field}`);
      }
    }
  }
}

export async function createManagedProduct(c, body) {
  const { env } = c;

  if (!body.name) {
    throw new BadRequestError('Name is required');
  }
  const normalizedCurrency = normalizeProductCurrency(body.currency);
  if (!normalizedCurrency) {
    throw new BadRequestError('Invalid currency code');
  }
  body.currency = normalizedCurrency;
  validateVariants(body.variants);

  const repo = new ProductRepository(env.DB);
  const normalizedSpu = typeof body.spu === 'string' ? body.spu.trim() : '';

  if (normalizedSpu) {
    body.spu = normalizedSpu;
    const existing = await repo.findBySpu(normalizedSpu);
    if (existing) {
      throw new ConflictError('SPU already exists');
    }
  }

  let product = null;
  try {
    product = await repo.create(body);

    const dimensionRepo = new ProductDimensionRepository(env.DB);
    const inputDimensions = Array.isArray(body.dimensions) ? body.dimensions : [];
    const createdDimensions = [];
    for (let i = 0; i < inputDimensions.length; i++) {
      const input = inputDimensions[i] || {};
      const created = await dimensionRepo.createDimension(product.id, {
        name: input.name,
        sort_order: Number.isInteger(input.sort_order) ? input.sort_order : i,
      });
      createdDimensions.push(created);
      const values = Array.isArray(input.values) ? input.values : [];
      for (let j = 0; j < values.length; j++) {
        const rawValue = values[j];
        const value = typeof rawValue === 'string' ? rawValue : rawValue?.value;
        if (!String(value || '').trim()) continue;
        const payload = { value, sort_order: j };
        if (rawValue && typeof rawValue === 'object' && Object.prototype.hasOwnProperty.call(rawValue, 'meta')) {
          payload.meta = rawValue.meta;
        }
        await dimensionRepo.addValue(product.id, created.id, payload);
      }
    }

    const normalizedVariants = normalizeVariantDimensionKeys(
      normalizeVariantExternalCodes(body.variants),
      createdDimensions
    );
    const variantRepo = new ProductVariantRepository(env.DB);
    const createdVariants = await variantRepo.createBatch(product.id, normalizedVariants);

    const variantImageRepo = new VariantImageRepository(env.DB, variantRepo);
    const imageSyncPlan = resolveVariantImageSyncPlan({
      inputVariants: normalizedVariants,
      persistedVariants: createdVariants,
    });
    if (imageSyncPlan.unresolved.length > 0) {
      throw new BadRequestError(`Unable to reconcile variant image targets: ${JSON.stringify(imageSyncPlan.unresolved)}`);
    }
    for (const task of imageSyncPlan.tasks) {
      await variantImageRepo.syncImages(product.id, task.variantId, task.images);
    }
    try {
      await archiveVariantImagesByFolder(env, product.id, imageSyncPlan.tasks);
    } catch (error) {
      console.error('Archive variant images by folder failed (product create):', error);
    }
  } catch (error) {
    if (product?.id) {
      await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(product.id).run();
    }
    throw error;
  }

  scheduleProductCacheInvalidation(c, env.DB, { productIds: [product?.id || null] });
  return product;
}
