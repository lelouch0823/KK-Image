import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

describe('PurchaseOrders design-system migration', () => {
  it('uses the shared management shell and delegated list surfaces', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).toContain('ManagementListShell');
    expect(source).toContain('PurchaseOrderOverviewBanner');
    expect(source).toContain('PurchaseOrderListTable');
  });

  it('uses shared buttons for pagination controls', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });

  it('keeps drawer workflows delegated to shared purchase-order surfaces', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).toContain('PurchaseOrderDetailDrawer');
    expect(source).toContain('PurchaseOrderCreateDrawer');
    expect(source).toContain('PurchaseOrderReceiptModal');
    expect(source).toContain('PurchaseOrderShortageModal');
    expect(source).toContain('PurchaseOrderCostModal');
  });

  it('keeps pagination and management actions on shared AppButton primitives', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).toContain("variant=\"secondary\"");
    expect(source).toContain("variant=\"primary\"");
    expect(source).toContain("variant=\"outline\"");
  });

  it('keeps permission-denied and success shells on shared typography tokens', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).not.toContain('font-[Outfit]');
  });

  it('does not reintroduce legacy overview shell state at the top level', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).not.toContain('const activeFilterLabel = computed(() => {');
    expect(source).toContain(':console-signals="consoleSignals"');
  });
});
