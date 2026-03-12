import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('OrderManager design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/OrderManager.vue'), 'utf8');
    expect(source).toContain('ManagementListShell');
  });

  it('keeps the page title in the shell instead of the filter bar', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/order/OrderFilters.vue'), 'utf8');
    expect(source).toContain('<AppFilterBar');
    expect(source).not.toContain('<AppFilterBar :title=');
    expect(source).not.toContain('<AppFilterBar :subtitle=');
  });
});
