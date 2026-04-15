import { normalizeVariantDimensionKeys, normalizeVariantExternalCodes } from '../../lib/hono/routes/manage/products/variant-normalizers.js';
import { BadRequestError, ConflictError } from '../../lib/hono/errors.js';
import { validateProductPayload } from '../../lib/hono/routes/manage/products/product-schema.js';
import { cleanupCreatedCatalogRecords } from './maintenance.js';
import { syncCatalogVariantImages } from './variant-images.js';

export async function executeProductCatalogCreate({
    db,
    env,
    body,
    productRepo,
    variantRepo,
    dimensionRepo,
}) {
    if (!body.name) {
        throw new BadRequestError('Name is required');
    }

    body = validateProductPayload(body, { requireVariants: true });

    const normalizedSpu = typeof body.spu === 'string' ? body.spu.trim() : '';
    if (normalizedSpu) {
        body.spu = normalizedSpu;
        const existing = await productRepo.findBySpu(normalizedSpu);
        if (existing) {
            throw new ConflictError('SPU already exists');
        }
    }

    const created = {
        productId: null,
        dimensionIds: [],
        dimensionValueIds: [],
        variantIds: [],
    };

    let product = null;
    try {
        product = await productRepo.create(body);
        created.productId = product.id;

        const inputDimensions = Array.isArray(body.dimensions) ? body.dimensions : [];
        const createdDimensions = [];
        for (let index = 0; index < inputDimensions.length; index += 1) {
            const input = inputDimensions[index] || {};
            const dimension = await dimensionRepo.createDimension(product.id, {
                name: input.name,
                sort_order: Number.isInteger(input.sort_order) ? input.sort_order : index,
            });
            created.dimensionIds.push(dimension.id);
            createdDimensions.push(dimension);

            const values = Array.isArray(input.values) ? input.values : [];
            for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
                const rawValue = values[valueIndex];
                const value = typeof rawValue === 'string' ? rawValue : rawValue?.value;
                if (!String(value || '').trim()) continue;

                const payload = { value, sort_order: valueIndex };
                if (
                    rawValue
                    && typeof rawValue === 'object'
                    && Object.prototype.hasOwnProperty.call(rawValue, 'meta')
                ) {
                    payload.meta = rawValue.meta;
                }

                const createdValue = await dimensionRepo.addValue(product.id, dimension.id, payload);
                if (createdValue?.id) {
                    created.dimensionValueIds.push(createdValue.id);
                }
            }
        }

        const normalizedVariants = normalizeVariantDimensionKeys(
            normalizeVariantExternalCodes(body.variants),
            createdDimensions
        );
        const createdVariants = await variantRepo.createBatch(product.id, normalizedVariants);
        created.variantIds.push(...createdVariants.map((variant) => variant.id).filter(Boolean));

        await syncCatalogVariantImages({
            db,
            env,
            productId: product.id,
            inputVariants: normalizedVariants,
            persistedVariants: createdVariants,
            variantRepo,
            archiveLogLabel: 'product create',
        });
    } catch (error) {
        await cleanupCreatedCatalogRecords({ db, created });
        throw error;
    }

    return product;
}
