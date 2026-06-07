import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('OrderTable design-system migration', () => {
  it('uses AppCheckbox instead of native checkbox inputs', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/order/OrderTable.vue'),
      'utf8'
    );

    expect(source).toContain("import AppCheckbox from '@/components/ui/AppCheckbox.vue'");
    expect(source).not.toContain('<input');
  });
});
