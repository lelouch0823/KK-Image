import { describe, it, expect } from 'vitest';
import { mergeIncomingWithExisting, buildVariantMatchKey } from '../../lib/hono/routes/manage/products/batch.js';

describe('Product Import Variant Merge Logic', () => {
    
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

});
