import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Customers design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Customers.vue'), 'utf8');

    expect(source).toContain('ManagementListShell');
  });

  it('avoids nesting the list inside an extra page-level card shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/Customers.vue'), 'utf8');

    expect(source).not.toContain(
      'flex h-full overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-page) shadow-sm'
    );
  });
});
