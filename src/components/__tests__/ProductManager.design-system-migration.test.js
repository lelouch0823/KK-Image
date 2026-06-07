import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ProductManager design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/ProductManager.vue'),
      'utf8'
    );
    expect(source).toContain('ManagementListShell');
    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain('ConfirmDialog');
    expect(source).not.toContain('<button');
    expect(source).not.toContain('confirm(');
  });

  it('uses lightweight pagination framing inside the content shell', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/ProductManager.vue'),
      'utf8'
    );

    expect(source).not.toContain('border-t border-(--border-color) bg-(--bg-muted) p-4');
  });
});
