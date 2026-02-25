import { describe, expect, it } from 'vitest';
import { extractInternalCodes, getItemMatchKey } from '../match-keys.js';

describe('import match keys', () => {
    it('getItemMatchKey should prioritize variant_code then product_code then spu then name', () => {
        expect(getItemMatchKey({
            name: 'N',
            spu: 'S1',
            product_code: 'P1',
            variant_code: 'V1',
        })).toBe('V1');

        expect(getItemMatchKey({
            name: 'N',
            spu: 'S1',
            product_code: 'P1',
        })).toBe('P1');

        expect(getItemMatchKey({
            name: 'N',
            spu: 'S1',
        })).toBe('S1');

        expect(getItemMatchKey({
            name: 'N',
        })).toBe('N');
    });

    it('extractInternalCodes should parse hidden product/variant codes from file headers', () => {
        const headers = ['Name', 'Product Code', 'Variant Code'];
        const row = ['Chair', 'P0001', 'V0001'];

        expect(extractInternalCodes(headers, row)).toEqual({
            product_code: 'P0001',
            variant_code: 'V0001',
        });
    });
});
