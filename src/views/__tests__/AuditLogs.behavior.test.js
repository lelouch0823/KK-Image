import { describe, expect, it } from 'vitest';
import {
  formatAuditAction,
  formatAuditDetails,
  formatAuditTarget,
  normalizeAuditRow,
} from '@/utils/audit-log';

describe('AuditLogs behavior', () => {
  it('normalizes structured rows without throwing on malformed legacy payloads', () => {
    const row = normalizeAuditRow({
      actor_name: 'Admin',
      action: 'order.update',
      payload: '{bad-json',
      metadata_json: '{still-bad',
      changes_json: null,
    });

    expect(row.actor_display).toBe('Admin');
    expect(row.metadata_display).toBe(null);
    expect(row.summary_display).toContain('更新订单');
  });

  it('formats details from changes_json first', () => {
    const details = formatAuditDetails({
      changes_json: '{"before":{"status":"pending"},"after":{"status":"done"}}',
      metadata_json: '{"reason":"manual"}',
    });

    expect(details).toContain('变更后');
    expect(details).toContain('"done"');
  });

  it('maps audit action codes to user-facing labels', () => {
    expect(formatAuditAction('admin.auth.login')).toBe('管理员登录');
    expect(formatAuditAction('purchase_order.item.delete')).toBe('删除采购单明细');
    expect(formatAuditAction('inventory_stock.adjust')).toBe('调整库存数量');
    expect(formatAuditAction('custom.event_name')).toBe('Custom event name');
  });

  it('formats audit target objects with readable target types', () => {
    expect(
      formatAuditTarget({
        target_type: 'purchase_order_item',
        target_label: 'PO-20260608-001 / SKU-1',
      })
    ).toBe('采购单明细 / PO-20260608-001 / SKU-1');

    expect(
      formatAuditTarget({
        target_type: 'custom_entity',
        target_id: 'entity-1',
      })
    ).toBe('Custom entity / entity-1');
  });

  it('normalizes rows with display fields for action, target, details, and fallback summary', () => {
    const row = normalizeAuditRow({
      actor_name: 'Admin',
      action: 'purchase_order.item.delete',
      target_type: 'purchase_order_item',
      target_id: 'item-1',
      metadata_json: '{"orderNumber":"PO-20260608-001","itemId":"item-1","reason":"录入错误"}',
    });

    expect(row.action_display).toBe('删除采购单明细');
    expect(row.target_display).toBe('采购单明细 / item-1');
    expect(row.details_display).toBe('采购单号：PO-20260608-001；明细ID：item-1；原因：录入错误');
    expect(row.summary_display).toBe('Admin 删除采购单明细 采购单明细 / item-1');
  });
});
