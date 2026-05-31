import {
  getPurchaseOrderCancelledQty,
  getPurchaseOrderOrderedQty,
  getPurchaseOrderOutstandingQty,
  getPurchaseOrderReceivedQty,
} from '@/utils/purchase-order-progress';

const toProgressNumber = (value: unknown): number => Number(value || 0);

export const createReceiptProgressSummaryBuilder = ({ t }: { t: (key: string, fallback?: string) => string }) => (record: Record<string, any> = {}): string => {
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

export const createReceiptMetaBuilder = ({ t, formatDate }: { t: (key: string, fallback?: string) => string; formatDate: (ts: unknown) => string }) => (record: Record<string, any> = {}): string => {
  const parts: string[] = [];
  const receiptCount = toProgressNumber(record.receipt_count);
  if (receiptCount > 0) {
    parts.push(`${receiptCount} ${t('purchaseOrder.progress.receiptCountSuffix', '次入库')}`);
  }
  if (record.last_received_at) {
    parts.push(
      `${t('purchaseOrder.progress.lastReceivedPrefix', '最近到货')} ${formatDate(record.last_received_at)}`
    );
  }
  return parts.join(' · ');
};

export const hasReceiptMeta = (record: Record<string, any> = {}): boolean =>
  toProgressNumber(record.receipt_count) > 0 || Boolean(record.last_received_at);
