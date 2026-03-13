import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/components/product/ProductFilters.vue'), 'utf8');

describe('ProductFilters desktop layout', () => {
  it('supports an actions slot inline with the search input on desktop', () => {
    expect(source).toContain('<slot name="actions" />');
    expect(source).toContain('lg:flex-1');
    expect(source).toContain('hidden shrink-0 items-center gap-2 lg:flex');
  });

  it('renders expanded filter controls for brand, category, stock, and status', () => {
    expect(source).toContain('update:brand');
    expect(source).toContain('update:category');
    expect(source).toContain('update:hasStock');
    expect(source).toContain('update:status');
  });
});
