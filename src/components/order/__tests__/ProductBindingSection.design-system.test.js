import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ProductBindingSection design-system migration', () => {
  it('uses shared controls for variant selection and destructive actions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/order/ProductBindingSection.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
    expect(source).not.toContain('<input');
  });
});
