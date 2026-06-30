export * from '../../shared/utils/purchase-order-projection.js';

import {
  getPurchaseOrderOrderedQty,
  getPurchaseOrderReceivedQty,
  getPurchaseOrderCancelledQty,
  getPurchaseOrderOutstandingQty,
} from '../../shared/utils/purchase-order-projection.js';

/**
 * 创建收货进度摘要格式化器
 * 返回一个函数，将采购单记录格式化为 "已到 X / 待收 Y · 取消 Z" 形式
 */
export const createReceiptProgressSummaryBuilder = ({ t }) => (record = {}) => {
  const ordered = getPurchaseOrderOrderedQty(record);
  const received = getPurchaseOrderReceivedQty(record);
  const cancelled = getPurchaseOrderCancelledQty(record);
  const outstanding = getPurchaseOrderOutstandingQty(record);

  const parts = [`${t('purchaseOrder.progress.receivedPrefix', '已到')} ${received} / ${ordered}`];
  if (cancelled > 0) {
    parts.push(`${t('purchaseOrder.progress.cancelledPrefix', '取消')} ${cancelled}`);
  }
  parts.push(`${t('purchaseOrder.progress.outstandingPrefix', '待收')} ${outstanding}`);
  return parts.join(' · ');
};
