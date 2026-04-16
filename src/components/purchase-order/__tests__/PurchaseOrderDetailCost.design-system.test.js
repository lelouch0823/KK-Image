import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PurchaseOrderDetailCost design-system migration', () => {
  it('uses shared actions for cost editing entry points', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/purchase-order/PurchaseOrderDetailCost.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
