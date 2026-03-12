import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PurchaseOrders design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).toContain('ManagementListShell');
  });

  it('relies on AppTable without an extra table card wrapper', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).not.toContain('overflow-hidden rounded-xl bg-(--bg-card) shadow-sm');
  });

  it('uses overview cards as the single status filter control', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).not.toContain('<template #filters>');
    expect(source).toContain('clickable');
    expect(source).toContain('flat');
    expect(source).toContain('no-border');
  });
});
