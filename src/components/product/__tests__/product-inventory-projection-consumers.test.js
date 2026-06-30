import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('product inventory projection consumers', () => {
  it('ProductTable prefers projection-backed available quantity fields', () => {
    // resolveDisplayStock 已提取到 product-display.ts
    const utilPath = path.resolve(process.cwd(), 'src/utils/product-display.ts');
    const utilSource = fs.readFileSync(utilPath, 'utf8');
    expect(utilSource).toContain('available_quantity');

    // ProductTable.vue 通过导入使用
    const filePath = path.resolve(process.cwd(), 'src/components/product/ProductTable.vue');
    const source = fs.readFileSync(filePath, 'utf8');
    expect(source).toContain('product-display');
  });

  it('ProductDetail prefers projection-backed available quantity fields', () => {
    const filePath = path.resolve(process.cwd(), 'src/components/product/ProductDetail.vue');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('available_quantity');
  });

  it('ProductDetail reads associated spaces with camelCase createdAt only', () => {
    const filePath = path.resolve(process.cwd(), 'src/components/product/ProductDetail.vue');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source).toContain('space.createdAt');
    expect(source).not.toContain('space.created_at');
    expect(source).toContain('space.viewCount');
    expect(source).not.toContain('space.view_count');
    expect(source).toContain('space.isPublic');
    expect(source).not.toContain('space.is_public');
  });
});
