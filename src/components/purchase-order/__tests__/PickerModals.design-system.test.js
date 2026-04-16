import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

describe('purchase-order picker modal design system', () => {
  it('gives order picker a dedicated shell and toolbar anchors', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/purchase-order/OrderPickerModal.vue'),
      'utf8'
    );

    expect(source).toContain('data-testid="purchase-order-order-picker-shell"');
    expect(source).toContain('data-testid="purchase-order-order-picker-toolbar"');
    expect(source).toContain('<Modal');
    expect(source).toContain('<ActionBar');
    expect(source).toContain('<AppCheckbox');
    expect(source).toContain('<AppButton');
    expect(source).not.toContain('font-[Outfit]');
    expect(source).not.toContain('bg-linear-to');
    expect(source).not.toContain('radial-gradient');
  });

  it('gives product picker a dedicated shell and toolbar anchors', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/purchase-order/ProductPickerModal.vue'),
      'utf8'
    );

    expect(source).toContain('data-testid="purchase-order-product-picker-shell"');
    expect(source).toContain('data-testid="purchase-order-product-picker-toolbar"');
    expect(source).toContain('data-testid="purchase-order-product-picker-search"');
    expect(source).toContain(
      ':data-testid="`purchase-order-product-picker-checkbox-${variant.variant_id}`"'
    );
    expect(source).toContain('<Modal');
    expect(source).toContain('<ActionBar');
    expect(source).toContain('<AppCheckbox');
    expect(source).toContain('<AppButton');
    expect(source).not.toContain('font-[Outfit]');
    expect(source).not.toContain('bg-linear-to');
    expect(source).not.toContain('radial-gradient');
  });
});
