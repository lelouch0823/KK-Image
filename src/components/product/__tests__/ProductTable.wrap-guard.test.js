import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/product/ProductTable.vue'),
  'utf8'
);

describe('ProductTable wrap guard', () => {
  it('keeps SPU and category content on a single truncated line', () => {
    expect(source).toContain('AppTableCodeChip');
    expect(source).toContain('max-width="12rem"');
    expect(source).toContain('max-w-[10rem]');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('truncate whitespace-nowrap align-middle');
  });

  it('renders status badges without splitting onto multiple lines', () => {
    expect(source).toContain('AppTableStatusPill');
  });
});
