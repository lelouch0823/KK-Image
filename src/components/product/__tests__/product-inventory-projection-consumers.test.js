import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('product inventory projection consumers', () => {
  it('ProductTable prefers projection-backed available quantity fields', () => {
    const filePath = path.resolve(process.cwd(), 'src/components/product/ProductTable.vue');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('available_quantity');
  });

  it('ProductDetail prefers projection-backed available quantity fields', () => {
    const filePath = path.resolve(process.cwd(), 'src/components/product/ProductDetail.vue');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('available_quantity');
  });
});
