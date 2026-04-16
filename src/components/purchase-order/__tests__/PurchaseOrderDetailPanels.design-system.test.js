import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const readSource = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('purchase-order detail panels design system remediation', () => {
  it('migrates receipt and item panels to AppButton and removes native buttons', () => {
    const panelFiles = [
      'src/components/purchase-order/PurchaseOrderReceiptsPanel.vue',
      'src/components/purchase-order/PurchaseOrderItemsPanel.vue',
    ];

    for (const panelFile of panelFiles) {
      const source = readSource(panelFile);
      expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
      expect(source).toContain('<AppButton');
      expect(source).not.toContain('<button');
    }
  });
});
