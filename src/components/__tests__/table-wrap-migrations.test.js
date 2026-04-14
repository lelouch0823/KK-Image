import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('high-risk table wrap migrations', () => {
  it('guards goods overview sku from uncontrolled wrapping', () => {
    const source = read('src/views/GoodsOverview.vue');
    expect(source).toContain('AppTableCodeChip');
    expect(source).toContain("kind: 'identifier'");
    expect(source).toContain('max-width="11rem"');
    expect(source).toContain('cell-sku');
  });

  it('guards trash original path from stretching rows', () => {
    const source = read('src/views/FileManager/TrashModal.vue');
    expect(source).toContain("kind: 'path'");
    expect(source).toContain("kind: 'numeric'");
    expect(source).toContain("kind: 'datetime'");
    expect(source).toContain('cell-originalLocation');
    expect(source).toContain('truncate');
    expect(source).toContain(':title="file.originalPath');
  });

  it('guards outbox event identifiers with truncation and fixed layout', () => {
    const source = read('src/components/outbox/OutboxEventTable.vue');
    expect(source).toContain('AppTableTextStack');
    expect(source).toContain('table-layout="fixed"');
    expect(source).toContain('primary-class="font-mono text-sm"');
    expect(source).toContain("secondary-class=\"row.id === selectedEventId ? 'text-primary' : ''\"");
  });

  it('guards share tokens and backup names from wrapping', () => {
    const shareSource = read('src/components/ShareManagementModal.vue');
    const backupSource = read('src/components/settings/tabs/BackupSettings.vue');

    expect(shareSource).toContain("kind: 'identifier'");
    expect(shareSource).toContain('AppTableCodeChip');
    expect(shareSource).toContain('AppTableTextStack');
    expect(shareSource).toContain('max-width="14rem"');
    expect(shareSource).toContain("kind: 'datetime'");
    expect(shareSource).toContain('table-layout="fixed"');
    expect(backupSource).toContain("kind: 'numeric'");
    expect(backupSource).toContain("kind: 'datetime'");
    expect(backupSource).toContain('table-layout="fixed"');
    expect(backupSource).toContain('truncate');
  });

  it('keeps order management status controls on a single line', () => {
    const orderTableSource = read('src/components/order/OrderTable.vue');
    const orderManagerSource = read('src/components/OrderManager.vue');
    const orderListStatusStackSource = read('src/components/order/OrderListStatusStack.vue');
    const orderListSource = read('src/components/order/OrderList.vue');
    const orderLinesCardSource = read('src/components/order/OrderLinesCard.vue');
    const orderPrintViewSource = read('src/components/order/OrderPrintView.vue');
    const orderLineProcurementStateSource = read('src/components/order/OrderLineProcurementState.vue');
    const statusChangerSource = read('src/components/OrderStatusChanger.vue');
    const procurementBadgeSource = read('src/components/order/OrderProcurementBadge.vue');
    const productTableSource = read('src/components/product/ProductTable.vue');
    const goodsOverviewSource = read('src/views/GoodsOverview.vue');

    expect(orderTableSource).not.toContain('table-layout="fixed"');
    expect(orderTableSource).toContain("kind: 'numeric'");
    expect(orderTableSource).toContain("kind: 'datetime'");
    expect(orderTableSource).toContain("width: '1%'");
    expect(orderTableSource).toContain("minWidth: '7.5rem'");
    expect(orderTableSource).toContain("maxWidth: '9rem'");
    expect(orderTableSource).toContain("kind: 'status'");
    expect(orderManagerSource).toContain('OrderListStatusStack');
    expect(orderManagerSource).toContain('mode="manage"');
    expect(orderManagerSource).toContain(':procurement-status="resolveOrderProgressStatus(order)"');
    expect(orderListSource).toContain('OrderListStatusStack');
    expect(orderListSource).toContain('mode="list"');
    expect(orderLinesCardSource).toContain('OrderLineProcurementState');
    expect(orderPrintViewSource).toContain('OrderLineProcurementState');
    expect(orderLineProcurementStateSource).toContain('max-w-[8.5rem]');
    expect(orderLineProcurementStateSource).toContain('preset="line"');
    expect(orderLineProcurementStateSource).toContain('normalizeProcurementStatus');
    expect(orderListStatusStackSource).toContain("props.mode === 'manage'");
    expect(orderListStatusStackSource).toContain("return 'items-center text-center'");
    expect(orderListStatusStackSource).toContain("return 'items-end text-right'");
    expect(orderListStatusStackSource).toContain("return 'meta'");
    expect(orderListStatusStackSource).toContain("return 'line'");
    expect(orderListStatusStackSource).toContain(':show-chevron="false"');
    expect(orderListStatusStackSource).toContain('AppTableStatusPill');
    expect(productTableSource).toContain('AppTableStatusPill');
    expect(goodsOverviewSource).toContain('AppTableStatusPill');
    expect(statusChangerSource).toContain('whitespace-nowrap');
    expect(statusChangerSource).toContain('justify-center');
    expect(statusChangerSource).toContain('showChevron');
    expect(statusChangerSource).toContain("showChevron ? 'relative pl-3 pr-8' : 'px-3.5'");
    expect(statusChangerSource).toContain('truncate');
    expect(procurementBadgeSource).toContain('whitespace-nowrap');
    expect(procurementBadgeSource).toContain('justify-center');
    expect(procurementBadgeSource).toContain('text-center');
    expect(procurementBadgeSource).toContain("detail: { compact: true, dot: true, showLabel: true }");
    expect(procurementBadgeSource).toContain("line: { compact: true }");
    expect(procurementBadgeSource).toContain("meta: { appearance: 'meta' }");
  });

  it('supports numeric and datetime semantic kinds in app table migrations', () => {
    const appTableSource = read('src/components/ui/AppTable.vue');
    const goodsOverviewSource = read('src/views/GoodsOverview.vue');
    const outboxSource = read('src/components/outbox/OutboxEventTable.vue');

    expect(appTableSource).toContain("numeric: {");
    expect(appTableSource).toContain("datetime: {");
    expect(appTableSource).toContain('tabular-nums');
    expect(goodsOverviewSource).toContain("kind: 'numeric'");
    expect(outboxSource).toContain("kind: 'datetime'");
  });

  it('uses a shared primary-secondary text stack in dense list cells', () => {
    const orderTableSource = read('src/components/order/OrderTable.vue');
    const shareSource = read('src/components/ShareManagementModal.vue');
    const outboxSource = read('src/components/outbox/OutboxEventTable.vue');

    expect(orderTableSource).toContain('AppTableTextStack');
    expect(shareSource).toContain('AppTableTextStack');
    expect(outboxSource).toContain('AppTableTextStack');
  });
});
