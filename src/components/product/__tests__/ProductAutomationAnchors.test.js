import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('product automation anchors', () => {
  it('exposes stable detail anchors for imported product verification', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/product/ProductDetail.vue'),
      'utf8'
    );

    expect(source).toContain('data-testid="product-detail-content"');
    expect(source).toContain('data-testid="product-detail-brand"');
    expect(source).toContain('data-testid="product-detail-name"');
    expect(source).toContain('data-testid="product-detail-spu"');
    expect(source).toContain('data-testid="product-detail-price"');
    expect(source).toContain('data-testid="product-detail-total-stock"');
  });

  it('exposes import mode anchors for deterministic smoke flows', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/product/import/ImportMappingStep.vue'),
      'utf8'
    );

    expect(source).toContain('data-testid="product-import-mode-safe-merge"');
    expect(source).toContain('data-testid="product-import-mode-replace"');
  });
});
