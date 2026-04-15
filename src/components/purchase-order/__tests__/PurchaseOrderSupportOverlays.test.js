import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const readSource = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('PurchaseOrderSupportOverlays', () => {
  it('uses only supported AppButton variants for shortage confirm actions', () => {
    const source = readSource('src/components/purchase-order/PurchaseOrderSupportOverlays.vue');

    expect(source).toContain('<AppButton variant="secondary"');
    expect(source).not.toContain('variant="warning"');
  });
});
