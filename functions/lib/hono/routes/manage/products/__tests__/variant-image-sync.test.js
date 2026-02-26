import { describe, expect, it } from 'vitest';
import { resolveVariantImageSyncPlan } from '../variant-image-sync.js';

describe('resolveVariantImageSyncPlan', () => {
    it('matches by options signature when sku is missing', () => {
        const plan = resolveVariantImageSyncPlan({
            inputVariants: [
                {
                    sku: '',
                    options_values: { Size: 'M', Color: 'Red' },
                    images: [{ image_id: 'img-1', is_primary: 1 }],
                },
            ],
            persistedVariants: [
                {
                    id: 'v1',
                    sku: 'SKU-AUTO',
                    options_values: { Color: 'Red', Size: 'M' },
                },
            ],
        });

        expect(plan.unresolved).toEqual([]);
        expect(plan.tasks).toEqual([
            {
                variantId: 'v1',
                images: [{ image_id: 'img-1', is_primary: 1 }],
            },
        ]);
    });

    it('reports unresolved when matching is ambiguous', () => {
        const plan = resolveVariantImageSyncPlan({
            inputVariants: [
                {
                    sku: '',
                    options_values: { Color: 'Red' },
                    images: [{ image_id: 'img-1', is_primary: 1 }],
                },
            ],
            persistedVariants: [
                { id: 'v1', sku: '', options_values: { Color: 'Red' } },
                { id: 'v2', sku: '', options_values: { Color: 'Red' } },
            ],
        });

        expect(plan.tasks).toEqual([]);
        expect(plan.unresolved).toEqual([
            expect.objectContaining({
                index: 0,
                reason: 'ambiguous_match',
            }),
        ]);
    });
});

