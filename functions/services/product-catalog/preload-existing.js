import { chunkArray } from '../../lib/db/batch.js';

const DEFAULT_BATCH_IMPORT_CHUNK_SIZE = 100;

export const chunkBatchImportItems = (items = [], chunkSize = DEFAULT_BATCH_IMPORT_CHUNK_SIZE) =>
    chunkArray(items, chunkSize);

const normalizeSpu = (value) => {
    const normalized = String(value || '').trim();
    return normalized || null;
};

export async function preloadBatchImportExistingState({
    items = [],
    productRepo,
    variantRepo,
    dimensionRepo,
}) {
    const spuList = [...new Set(
        (items || [])
            .map((item) => normalizeSpu(item?.spu))
            .filter(Boolean)
    )];

    let productsBySpu = new Map();
    if (spuList.length > 0) {
        if (typeof productRepo?.findBySpuBatch === 'function') {
            productsBySpu = await productRepo.findBySpuBatch(spuList);
        } else {
            const entries = await Promise.all(spuList.map(async (spu) => [spu, await productRepo.findBySpu(spu)]));
            productsBySpu = new Map(entries.filter(([, row]) => row));
        }
    }

    const existingProducts = [...productsBySpu.values()].filter(Boolean);
    const productIds = [...new Set(existingProducts.map((product) => String(product?.id || '').trim()).filter(Boolean))];
    const productsById = new Map(existingProducts.map((product) => [product.id, product]));

    let variantsByProductId = new Map();
    if (typeof variantRepo?.findByProductIds === 'function') {
        variantsByProductId = await variantRepo.findByProductIds(productIds);
    } else if (productIds.length > 0) {
            const entries = await Promise.all(
                productIds.map(async (productId) => [productId, await variantRepo.findByProductId(productId)])
            );
            variantsByProductId = new Map(entries.map(([productId, rows]) => [productId, rows || []]));
    }

    const dimensionsByProductId = new Map();
    if (productIds.length > 0) {
        await Promise.all(productIds.map(async (productId) => {
            const snapshot = await dimensionRepo.listByProduct(productId);
            dimensionsByProductId.set(productId, snapshot || []);
        }));
    }

    return {
        productsBySpu,
        productsById,
        variantsByProductId,
        dimensionsByProductId,
    };
}
