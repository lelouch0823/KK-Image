import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('OrderForm design-system contract', () => {
  it('uses shared form and action primitives instead of raw controls', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/order/OrderForm.vue'),
      'utf8'
    );

    expect(source).toContain('AppInput');
    expect(source).toContain('AppButton');
    expect(source).not.toContain('<input');
    expect(source).not.toContain('<textarea');
    expect(source).not.toContain('<button');
  });
});
