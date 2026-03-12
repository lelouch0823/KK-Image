import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ProductManager design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ProductManager.vue'), 'utf8');
    expect(source).toContain('ManagementListShell');
  });

  it('uses lightweight pagination framing inside the content shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ProductManager.vue'), 'utf8');

    expect(source).not.toContain('border-t border-(--border-color) bg-(--bg-muted) p-4');
  });
});
