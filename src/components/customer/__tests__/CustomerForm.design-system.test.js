import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CustomerForm design-system migration', () => {
  it('uses shared controls for tag editing and removal affordances', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/customer/CustomerForm.vue'), 'utf8');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(source).not.toContain('<button');
    expect(source).not.toContain('<input');
  });
});
