import { describe, it, expect, vi } from 'vitest';
import { mergeIncomingWithExisting, buildVariantMatchKey } from '../../lib/hono/routes/manage/products/batch.js';
import { ProductCatalogService } from '../../services/ProductCatalogService.js';

describe('Product Import Variant Merge Logic', () => {
    it('exposes batch import orchestration on ProductCatalogService', () => {
        const service = new ProductCatalogService({});
        expect(typeof service.batchImport).toBe('function');
    });
    
    describe('buildVariantMatchKey', () => {
        it('uses variant_code primarily', () => {
            const variant = { variant_code: 'V-001', sku: 'S-001', options_values: { Color: 'Red' } };
            expect(buildVariantMatchKey(variant)).toBe('code:V-001');
        });

        it('falls back to sku if variant_code missing', () => {
            const variant = { sku: 'S-001', options_values: { Color: 'Red' } };
            expect(buildVariantMatchKey(variant)).toBe('sku:S-001');
        });

        it('falls back to sorted signature of options_values', () => {
            const variant = { options_values: { Size: 'L', Color: 'Red' } };
            expect(buildVariantMatchKey(variant)).toBe('sig:Color:Red|Size:L');
        });

        it('handles empty variant safely', () => {
            expect(buildVariantMatchKey({})).toBeNull();
        });
    });

    describe('mergeIncomingWithExisting', () => {
        it('updates existing variant matching by code, keeping its ID', () => {
            const existing = [
                { id: 'id-1', variant_code: 'V-001', price: 100 }
            ];
            const incoming = [
                { variant_code: 'V-001', price: 150, stock_quantity: 10 }
            ];

            const merged = mergeIncomingWithExisting(existing, incoming);
            expect(merged).toHaveLength(1);
            expect(merged[0].id).toBe('id-1');
            expect(merged[0].price).toBe(150);
            expect(merged[0].stock_quantity).toBe(10);
        });

        it('adds new incoming variant that does not match any existing', () => {
            const existing = [
                { id: 'id-1', variant_code: 'V-001' }
            ];
            const incoming = [
                { variant_code: 'V-002', price: 150 }
            ];

            const merged = mergeIncomingWithExisting(existing, incoming);
            expect(merged).toHaveLength(2);
            
            const incomingV = merged.find(v => v.variant_code === 'V-002');
            expect(incomingV).toBeDefined();
            expect(incomingV.id).toBeUndefined(); // It's new
            expect(incomingV.price).toBe(150);
        });

        it('preserves existing variants that are not present in incoming', () => {
            const existing = [
                { id: 'id-1', variant_code: 'V-001', price: 100 },
                { id: 'id-2', variant_code: 'V-KEEP', price: 200 }
            ];
            const incoming = [
                { variant_code: 'V-001', price: 150 }
            ];

            const merged = mergeIncomingWithExisting(existing, incoming);
            expect(merged).toHaveLength(2); // V-001 updated, V-KEEP preserved
            
            const vKeep = merged.find(v => v.variant_code === 'V-KEEP');
            expect(vKeep).toBeDefined();
            expect(vKeep.id).toBe('id-2');
            expect(vKeep.price).toBe(200);
        });

        it('can omit unmatched existing variants for replace mode', () => {
            const existing = [
                { id: 'id-1', variant_code: 'V-001', price: 100 },
                { id: 'id-2', variant_code: 'V-KEEP', price: 200 },
            ];
            const incoming = [
                { variant_code: 'V-001', price: 150 },
            ];

            const merged = mergeIncomingWithExisting(existing, incoming, { includeUnmatchedExisting: false });
            expect(merged).toHaveLength(1);
            expect(merged[0].id).toBe('id-1');
            expect(merged.find((v) => v.id === 'id-2')).toBeUndefined();
        });

        it('matches by signature correctly', () => {
            const existing = [
                { id: 'id-sig', options_values: { Size: 'M', Color: 'Blue' }, price: 100 }
            ];
            // Different order, same content
            const incoming = [
                { options_values: { Color: 'Blue', Size: 'M' }, price: 120 }
            ];

            const merged = mergeIncomingWithExisting(existing, incoming);
            expect(merged).toHaveLength(1);
            expect(merged[0].id).toBe('id-sig');
            expect(merged[0].price).toBe(120);
        });

        it('matches existing variant by sku when existing also has variant_code', () => {
            const existing = [
                {
                    id: 'id-1',
                    variant_code: 'VC-1',
                    sku: 'SKU-1',
                    options_values: { Color: 'Red' },
                    price: 100,
                },
            ];
            const incoming = [
                {
                    sku: 'SKU-1',
                    options_values: { Color: 'Red' },
                    price: 120,
                },
            ];

            const merged = mergeIncomingWithExisting(existing, incoming);
            expect(merged).toHaveLength(1);
            expect(merged[0].id).toBe('id-1');
            expect(merged[0].price).toBe(120);
        });

        it('does not falsely match when both variants have no code/sku/signature', () => {
            const existing = [
                { id: 'id-empty', price: 100 }
            ];
            const incoming = [
                { price: 120 }
            ];

            const merged = mergeIncomingWithExisting(existing, incoming);
            expect(merged).toHaveLength(2);
            const updated = merged.find(v => v.id === 'id-empty' && v.price === 120);
            expect(updated).toBeUndefined();
        });
    });

    it('batch import preloads once per chunk and avoids per-item lookup/write chain', async () => {
        const service = new ProductCatalogService({});
        service.productRepo.findBySpu = vi.fn();
        service.productRepo.create = vi.fn();
        service.productRepo.updateWithMeta = vi.fn();
        service.variantRepo.findByProductId = vi.fn();
        service.variantRepo.syncVariants = vi.fn();

        service.productRepo.findBySpuBatch = vi.fn(async () => new Map());
        service.variantRepo.findByProductIds = vi.fn(async () => new Map());
        service.productRepo.bulkUpsertFromImport = vi.fn(async (rows) => ({
            successes: rows.map((row, index) => ({
                itemKey: row.itemKey,
                operation: row.operation,
                productId: row.productId || `created-${index}`,
            })),
            failures: [],
        }));
        service.variantRepo.bulkSyncFromImport = vi.fn(async (plans) => ({
            successes: plans.map((plan) => ({
                itemKey: plan.itemKey,
                productId: plan.productId,
                stats: {
                    createdCount: 1,
                    updatedCount: 0,
                    archivedCount: 0,
                    reactivatedCount: 0,
                },
            })),
            failures: [],
        }));

        const result = await service.batchImport(
            { env: {}, executionCtx: { waitUntil: vi.fn() } },
            {
                import_mode: 'safe_merge',
                items: [
                    {
                        name: 'Tee A',
                        spu: 'SPU-A',
                        variants: [{ sku: 'SKU-A', price: 100, options_values: { Color: 'Red' } }],
                    },
                    {
                        name: 'Tee B',
                        spu: 'SPU-B',
                        variants: [{ sku: 'SKU-B', price: 200, options_values: { Color: 'Blue' } }],
                    },
                ],
            },
            { skipCacheInvalidation: true }
        );

        expect(service.productRepo.findBySpuBatch).toHaveBeenCalledTimes(1);
        expect(service.variantRepo.findByProductIds).toHaveBeenCalledTimes(1);
        expect(service.productRepo.bulkUpsertFromImport).toHaveBeenCalledTimes(1);
        expect(service.variantRepo.bulkSyncFromImport).toHaveBeenCalledTimes(1);

        expect(service.productRepo.findBySpu).not.toHaveBeenCalled();
        expect(service.productRepo.create).not.toHaveBeenCalled();
        expect(service.productRepo.updateWithMeta).not.toHaveBeenCalled();
        expect(service.variantRepo.findByProductId).not.toHaveBeenCalled();
        expect(service.variantRepo.syncVariants).not.toHaveBeenCalled();

        expect(result.summary.failedProducts).toBe(0);
        expect(result.count).toBe(2);
    });

});
