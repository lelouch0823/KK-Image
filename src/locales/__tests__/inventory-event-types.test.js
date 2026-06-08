import { describe, expect, it } from 'vitest';
import zhCNInventoryDashboard from '../zh-CN/inventoryDashboard';

describe('inventory dashboard event type labels', () => {
  it('covers domain outbox inventory events with business labels', () => {
    expect(zhCNInventoryDashboard.movements.eventType.purchase_receipt_recorded).toBe(
      '采购收货已登记'
    );
    expect(zhCNInventoryDashboard.movements.eventType.inventory_received).toBe('库存已入库');
    expect(zhCNInventoryDashboard.movements.eventType.order_procurement_progressed).toBe(
      '预定单采购进度已推进'
    );
    expect(zhCNInventoryDashboard.movements.eventType.purchase_receipt_reversed).toBe(
      '采购收货已冲销'
    );
    expect(zhCNInventoryDashboard.movements.eventType.inventory_receipt_reversed).toBe(
      '库存收货已冲销'
    );
  });
});
