import { ProductRepository } from '../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { ProductDimensionRepository } from '../repositories/ProductDimensionRepository.js';
import { VariantAuditRepository } from '../repositories/VariantAuditRepository.js';
import { scheduleProductCacheInvalidation } from '../lib/hono/routes/manage/products/cache-helpers.js';
import { NotFoundError } from '../lib/hono/errors.js';
import { executeProductCatalogCreate } from "./product-catalog/create.js";
import { syncProductCatalogDimensions } from "./product-catalog/dimensions.js";
import { executeProductCatalogPatch } from "./product-catalog/patch.js";
import { executeProductCatalogBatchImport } from "./product-catalog/batch-execution.js";

const isVariantSyncValidationError = (error) => {
    const message = String(error?.message || '');
    return (
        message.includes('duplicate variant signature in payload') ||
        message.includes('variant signature must be unique per product')
    );
};

export {
    assertBatchItem,
    normalizeImportMode,
} from "./product-catalog/batch-import.js";
export {
    buildVariantMatchKey,
    mergeIncomingWithExisting,
} from "./product-catalog/variant-matching.js";

export class ProductCatalogService {
    constructor(db) {
        this.db = db;
        this.productRepo = new ProductRepository(db);
        this.variantRepo = new ProductVariantRepository(db);
        this.dimensionRepo = new ProductDimensionRepository(db);
        this.auditRepo = new VariantAuditRepository(db);
    }

    async ensureProductExists(productId) {
        const product = await this.productRepo.findById(productId);
        if (!product) {
            throw new NotFoundError('Product not found');
        }
        return product;
    }

    async syncDimensionsFromPayload(productId, incomingDimensions = [], options = {}) {
        return syncProductCatalogDimensions({
            productId,
            incomingDimensions,
            replaceMissing: Boolean(options.replaceMissing),
            dimensionRepo: this.dimensionRepo,
        });
    }

    async createProduct(c, body, options = {}) {
        const {
            skipCacheInvalidation = false,
            cacheEventCommandId,
            cacheEventCorrelationId,
        } = options;
        const product = await executeProductCatalogCreate({
            db: this.db,
            env: c.env,
            body,
            productRepo: this.productRepo,
            variantRepo: this.variantRepo,
            dimensionRepo: this.dimensionRepo,
        });

        if (!skipCacheInvalidation) {
            await scheduleProductCacheInvalidation(c, {
                eventType: 'product_created',
                productIds: [product?.id || null],
            }, {
                commandId: cacheEventCommandId,
                correlationId: cacheEventCorrelationId,
            });
        }
        return product;
    }

    async patchProduct(c, productId, body, options = {}) {
        const {
            fullReplace = false,
            skipCacheInvalidation = false,
            cacheEventCommandId,
            cacheEventCorrelationId,
        } = options;

        const result = await executeProductCatalogPatch({
            db: this.db,
            env: c.env,
            productId,
            body,
            fullReplace,
            ensureProductExists: this.ensureProductExists.bind(this),
            syncDimensionsFromPayload: this.syncDimensionsFromPayload.bind(this),
            productRepo: this.productRepo,
            variantRepo: this.variantRepo,
            dimensionRepo: this.dimensionRepo,
            auditRepo: this.auditRepo,
            isVariantSyncValidationError,
        });

        if ((result.changes > 0) || result.variantsUpdated || result.variantSync) {
            if (!skipCacheInvalidation) {
                await scheduleProductCacheInvalidation(c, {
                    eventType: fullReplace ? 'product_replaced' : 'product_updated',
                    productIds: [productId],
                }, {
                    commandId: cacheEventCommandId,
                    correlationId: cacheEventCorrelationId,
                });
            }
            return result;
        }

        return result;
    }

    async putProduct(c, productId, body, options = {}) {
        return this.patchProduct(c, productId, body, { ...options, fullReplace: true });
    }

    async batchImport(c, body = {}, importOptions = {}) {
        const {
            skipCacheInvalidation = false,
            cacheEventCommandId,
            cacheEventCorrelationId,
        } = importOptions;
        const result = await executeProductCatalogBatchImport({
            db: this.db,
            body,
            productRepo: this.productRepo,
            variantRepo: this.variantRepo,
            dimensionRepo: this.dimensionRepo,
            syncDimensionsFromPayload: this.syncDimensionsFromPayload.bind(this),
        });

        if (result.success && !skipCacheInvalidation) {
            await scheduleProductCacheInvalidation(c, {
                eventType: 'product_batch_imported',
                productIds: result.productIds,
            }, {
                commandId: cacheEventCommandId,
                correlationId: cacheEventCorrelationId,
            });
        }

        return result;
    }
}
