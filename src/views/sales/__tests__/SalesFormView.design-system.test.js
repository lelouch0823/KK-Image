import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SalesFormView design-system migration', () => {
  it('uses shared buttons for inline retry actions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/views/sales/SalesFormView.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
