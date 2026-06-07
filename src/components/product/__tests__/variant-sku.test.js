import { describe, expect, it } from 'vitest';
import { buildVariantSku } from '../variant-sku';

describe('buildVariantSku', () => {
  it('uses spu prefix when provided', () => {
    const sku = buildVariantSku({
      spu: 'SPU001',
      optionsValues: { Color: 'Red', Size: 'M' },
      seed: 'abc12345',
    });
    expect(sku).toBe('SPU001-RED-M');
  });

  it('returns non-empty sku when spu is empty', () => {
    const sku = buildVariantSku({
      spu: '',
      optionsValues: { Color: 'Blue' },
      seed: 'abc12345',
    });
    expect(sku).toMatch(/^SKU-/);
    expect(sku).not.toBe('');
  });
});
