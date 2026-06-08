import { describe, expect, it } from 'vitest';
import {
  formatCustomerSegmentLabel,
  formatFileTypeLabel,
  formatOrderCostSourceLabel,
  formatOrderDeliveryStatusLabel,
  formatOrderProcurementStatusLabel,
  formatOrderStatusLabel,
  formatProductStatusLabel,
  formatStocktakeStatusLabel,
} from '../display-labels';

describe('display label helpers', () => {
  const t = (key, fallback) => {
    const labels = {
      'customer.detail.segmentVip': 'VIP 客户',
      'order.deliveryStatuses.in_transit': '运输中',
      'order.procurementStatuses.ordered': '已采购',
      'order.profit.costSources.purchase_order': '采购单',
      'order.statuses.confirmed': '已确认',
      'product.filters.status.active': '上架',
      'stocktake.status.counting': '盘点中',
    };
    return labels[key] || fallback || key;
  };

  it('uses translations for known product, customer, and stocktake values', () => {
    expect(formatProductStatusLabel(t, 'active')).toBe('上架');
    expect(formatCustomerSegmentLabel(t, 'vip')).toBe('VIP 客户');
    expect(formatStocktakeStatusLabel(t, 'counting')).toBe('盘点中');
    expect(formatOrderStatusLabel(t, 'confirmed')).toBe('已确认');
    expect(formatOrderProcurementStatusLabel(t, 'ordered')).toBe('已采购');
    expect(formatOrderDeliveryStatusLabel(t, 'in_transit')).toBe('运输中');
    expect(formatOrderCostSourceLabel(t, 'purchase_order')).toBe('采购单');
  });

  it('falls back to readable labels for unknown backend values', () => {
    expect(formatProductStatusLabel(t, 'seasonal_archive_review')).toBe(
      'Seasonal Archive Review'
    );
    expect(formatCustomerSegmentLabel(t, 'churn_risk')).toBe('Churn Risk');
    expect(formatStocktakeStatusLabel(t, 'warehouse_quality_hold')).toBe(
      'Warehouse Quality Hold'
    );
    expect(formatOrderStatusLabel(t, 'manual_review_required')).toBe('Manual Review Required');
    expect(formatOrderProcurementStatusLabel(t, 'supplier_quality_hold')).toBe(
      'Supplier Quality Hold'
    );
    expect(formatOrderDeliveryStatusLabel(t, 'carrier_exception')).toBe('Carrier Exception');
    expect(formatOrderCostSourceLabel(t, 'manual_adjustment')).toBe('Manual Adjustment');
  });

  it('formats MIME/file type values without exposing verbose raw subtype codes', () => {
    expect(formatFileTypeLabel('image/png')).toBe('PNG');
    expect(
      formatFileTypeLabel(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    ).toBe('Excel Spreadsheet');
    expect(formatFileTypeLabel('application/x-custom_report')).toBe('Custom Report');
  });
});
