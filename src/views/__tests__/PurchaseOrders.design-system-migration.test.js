import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

describe('PurchaseOrders design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).toContain('ManagementListShell');
  });

  it('relies on AppTable without an extra table card wrapper', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).not.toContain('overflow-hidden rounded-xl bg-(--bg-card) shadow-sm');
    expect(source).not.toContain('data-testid="purchase-order-list-panel"');
  });

  it('uses overview cards as the single status filter control', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).not.toContain('<template #filters>');
    expect(source).toContain('clickable');
    expect(source).toContain('flat');
    expect(source).toContain('no-border');
    expect(source).toContain('data-testid="purchase-order-overview-strip"');
  });

  it('gives po number, status, and total cost cells dedicated visual anchors', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).toContain('data-testid="purchase-order-po-chip"');
    expect(source).toContain('data-testid="purchase-order-status-badge"');
    expect(source).toContain('data-testid="purchase-order-total-cost"');
  });

  it('adds dedicated control-deck anchors for banner and modal shells', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).toContain('data-testid="purchase-order-console-banner"');
    expect(source).toContain('data-testid="purchase-order-create-shell"');
    expect(source).toContain('data-testid="purchase-order-suggestions-shell"');
  });

  it('replaces the heavy overview hero gradient with quieter panel framing', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).not.toContain('bg-linear-to-br from-sky-50/75 via-(--bg-card) to-amber-50/45');
    expect(source).toContain('data-testid="purchase-order-console-banner"');
    expect(source).toContain('data-testid="purchase-order-overview-strip"');
    expect(source).toContain('rounded-[1.75rem] border border-(--border-color)/60 bg-(--bg-card) p-4');
    expect(source).toContain('shadow-[0_18px_50px_-42px_rgba(15,23,42,0.28)]');
    expect(source).toContain('rgba(59,130,246,0.08),transparent_30%');
    expect(source).toContain('rgba(249,115,22,0.06),transparent_24%');
  });

  it('avoids feature-card gradients inside the detail workspace', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');
    const detailStart = source.indexOf('data-testid="purchase-order-detail-shell"');
    const detailEnd = source.indexOf('data-testid="purchase-order-create-shell"');
    const detailWorkspace = detailStart >= 0 && detailEnd > detailStart
      ? source.slice(detailStart, detailEnd)
      : '';

    expect(detailWorkspace).toContain('data-testid="purchase-order-detail-summary"');
    expect(detailWorkspace).toContain('data-testid="purchase-order-detail-progress"');
    expect(detailWorkspace).toContain('data-testid="purchase-order-detail-cost"');
    expect(detailWorkspace).toContain('data-testid="purchase-order-detail-items"');
    expect(detailWorkspace).toContain('data-testid="purchase-order-detail-receipts"');
    expect(detailWorkspace).not.toContain('bg-linear-to-r from-sky-50/75 via-(--bg-card) to-amber-50/40');
    expect(detailWorkspace).not.toContain('bg-linear-to-br from-(--bg-card) via-(--bg-card) to-sky-50/35');
    expect(detailWorkspace).not.toContain('bg-linear-to-br from-(--bg-card) via-(--bg-card) to-amber-50/45');
    expect(detailWorkspace).not.toContain('bg-linear-to-r from-(--bg-card) via-(--bg-card) to-sky-50/30');
    expect(detailWorkspace).not.toContain('bg-linear-to-r from-(--bg-card) via-(--bg-card) to-emerald-50/28');
    expect(detailWorkspace).not.toContain('bg-linear-to-r from-(--bg-card) to-(--bg-muted)/35');
  });

  it('uses ledger-style toolbar structure and copy for the table context', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');
    const toolbarBlock = source.match(/<template #toolbar>[\s\S]*?<\/template>/)?.[0] || '';

    expect(source).toContain('<template #toolbar>');
    expect(toolbarBlock).toContain('<h3 class="text-sm font-semibold text-(--text-main)">Order Ledger</h3>');
    expect(toolbarBlock).toContain("t('purchaseOrder.ui.tableHint', '主状态和到货进度在同一列聚合展示，便于快速扫读链路卡点。')");
    expect(toolbarBlock).toContain('<div class="text-xs text-(--text-secondary) lg:text-right">');
    expect(toolbarBlock).toContain("t('purchaseOrder.ui.liveHint', '点击行可查看采购链路详情')");
    expect(toolbarBlock).not.toContain('<StatusBadge');
  });

  it('drops the table-row cost pill so money reads as calmer ledger data', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');
    const totalCostCell = source.match(/<template #cell-total_goods_cost="\{ row: po \}">[\s\S]*?<\/template>/)?.[0] || '';

    expect(source).not.toContain('inline-flex min-w-[7.5rem] justify-end rounded-lg bg-(--bg-muted)/65');
    expect(source).toContain('data-testid="purchase-order-total-cost"');
    expect(totalCostCell).toContain('inline-flex min-w-[7.5rem] justify-end font-mono text-sm font-semibold text-(--text-main) tabular-nums');
    expect(totalCostCell).not.toContain('font-[Outfit]');
    expect(totalCostCell).not.toContain('rounded-lg');
    expect(totalCostCell).not.toContain('bg-(--bg-muted)');
  });

  it('removes dead top-level overview state from the script', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/PurchaseOrders.vue'), 'utf8');

    expect(source).not.toContain('const activeFilterLabel = computed(() => {');

    const consoleSignalsBlock = source.match(/const consoleSignals = computed\(\(\) => \{[\s\S]*?\n\}\);\n\nconst detailSummaryCards = computed/);
    expect(consoleSignalsBlock?.[0]).toBeTruthy();
    expect(consoleSignalsBlock?.[0]).not.toContain('badge:');
    expect(consoleSignalsBlock?.[0]).not.toContain('variant:');
  });
});
