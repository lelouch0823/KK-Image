// 从 utils 重新导出，保持向后兼容
export { createReceiptProgressSummaryBuilder } from '@/utils/purchase-order-progress';

const toProgressNumber = (value: unknown): number => Number(value || 0);

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
