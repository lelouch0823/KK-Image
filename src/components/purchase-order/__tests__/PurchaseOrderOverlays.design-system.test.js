import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const readSource = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('purchase-order overlays design system remediation', () => {
  it('migrates cost/receipt/shortage/reversal modals to overlay scaffold + action bar buttons', () => {
    const modalFiles = [
      'src/components/purchase-order/PurchaseOrderCostModal.vue',
      'src/components/purchase-order/PurchaseOrderReceiptModal.vue',
      'src/components/purchase-order/PurchaseOrderShortageModal.vue',
      'src/components/purchase-order/PurchaseOrderReceiptReversalModal.vue',
    ];

    for (const modalFile of modalFiles) {
      const source = readSource(modalFile);
      expect(source).toContain('<OverlayScaffold');
      expect(source).toContain('<ActionBar');
      expect(source).toContain('<AppButton');
      expect(source).not.toContain('bg-linear-to');
      expect(source).not.toContain('radial-gradient');
    }
  });

  it('migrates suggestions overlay to shared modal/actions and removes custom spinner shell', () => {
    const source = readSource('src/components/purchase-order/PurchaseOrderSuggestionsDrawer.vue');

    expect(source).toContain('<Modal');
    expect(source).toContain('<ActionBar');
    expect(source).toContain('<AppButton');
    expect(source).not.toContain('bg-linear-to');
    expect(source).not.toContain('radial-gradient');
    expect(source).not.toContain('border-4 border-t-transparent');
  });

  it('migrates shortage confirm support overlay to shared modal/actions', () => {
    const source = readSource('src/components/purchase-order/PurchaseOrderSupportOverlays.vue');

    expect(source).toContain('<Modal');
    expect(source).toContain('<ActionBar');
    expect(source).toContain('<AppButton');
    expect(source).not.toContain('bg-linear-to');
    expect(source).not.toContain('radial-gradient');
  });
});
