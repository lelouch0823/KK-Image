import { computed } from 'vue';
import { createReceiptProgressSummaryBuilder } from '@/views/purchase-orders/progress.js';

const formatInteger = (value) => Number(value || 0).toLocaleString('zh-CN');

const getListStatusVariant = (status) => {
  if (['draft', 'cancelled'].includes(status)) return 'default';
  if (status === 'ordered') return 'warning';
  if (status === 'shipping') return 'primary';
  if (status === 'arrived') return 'info';
  return 'success';
};

export function usePurchaseOrderListPresentation({ stats, t }) {
  const statCards = computed(() => {
    if (!stats.value) return [];

    return [
      {
        key: '',
        label: t('purchaseOrder.filter.all'),
        count: stats.value.total || 0,
        icon: 'bars-4',
        tone: 'primary',
      },
      {
        key: 'draft',
        label: t('purchaseOrder.status.draft'),
        count: stats.value.draft_count || 0,
        icon: 'pencil-square',
        tone: 'slate',
      },
      {
        key: 'ordered',
        label: t('purchaseOrder.status.ordered'),
        count: stats.value.ordered_count || 0,
        icon: 'clipboard-document-check',
        tone: 'warning',
      },
      {
        key: 'shipping',
        label: t('purchaseOrder.status.shipping'),
        count: stats.value.shipping_count || 0,
        icon: 'truck',
        tone: 'primary',
      },
      {
        key: 'arrived',
        label: t('purchaseOrder.status.arrived'),
        count: stats.value.arrived_count || 0,
        icon: 'cube',
        tone: 'success',
      },
      {
        key: 'completed',
        label: t('purchaseOrder.status.completed'),
        count: stats.value.completed_count || 0,
        icon: 'check-badge',
        tone: 'info',
      },
    ];
  });

  const columns = computed(() => [
    { key: 'po_no', label: t('purchaseOrder.table.poNo') },
    { key: 'status', label: t('purchaseOrder.table.status') },
    { key: 'item_count', label: t('purchaseOrder.table.itemCount'), align: 'center' },
    { key: 'total_goods_cost', label: t('purchaseOrder.table.totalGoodsCost') },
    { key: 'remark', label: t('purchaseOrder.form.remark') },
    { key: 'created_at', label: t('purchaseOrder.table.createdAt') },
  ]);

  const progressStatusConfig = computed(() => ({
    open: { label: t('purchaseOrder.progress.open', '待到货'), variant: 'warning' },
    partially_received: {
      label: t('purchaseOrder.progress.partiallyReceived', '部分到货'),
      variant: 'primary',
    },
    received: { label: t('purchaseOrder.progress.received', '已全部到货'), variant: 'success' },
    cancelled: { label: t('purchaseOrder.progress.cancelled', '已取消'), variant: 'default' },
  }));

  const getProgressStatusMeta = (status) =>
    progressStatusConfig.value[status] || progressStatusConfig.value.open;

  const getProgressStatusLabel = (status) => getProgressStatusMeta(status).label;

  const getProgressStatusVariant = (status) => getProgressStatusMeta(status).variant;

  const buildReceiptProgressSummary = createReceiptProgressSummaryBuilder({ t });

  const consoleSignals = computed(() => {
    if (!stats.value) return [];

    const draftCount = Number(stats.value.draft_count || 0);
    const activeCount =
      Number(stats.value.ordered_count || 0) +
      Number(stats.value.shipping_count || 0) +
      Number(stats.value.arrived_count || 0);
    const completedCount = Number(stats.value.completed_count || 0);

    return [
      {
        key: 'active',
        label: t('purchaseOrder.ui.activeWork', '在途链路'),
        value: formatInteger(activeCount),
        hint: t('purchaseOrder.ui.activeWorkHint', '已下单、运输中、待结算采购单总和。'),
      },
      {
        key: 'draft',
        label: t('purchaseOrder.ui.draftBacklog', '草稿堆积'),
        value: formatInteger(draftCount),
        hint: t('purchaseOrder.ui.draftBacklogHint', '等待补货明细、成本策略或关联订单的草稿。'),
      },
      {
        key: 'completed',
        label: t('purchaseOrder.ui.settlementClosed', '已结算'),
        value: formatInteger(completedCount),
        hint: t('purchaseOrder.ui.settlementClosedHint', '已完成入库与结算闭环的采购单。'),
      },
    ];
  });

  return {
    statCards,
    columns,
    consoleSignals,
    buildReceiptProgressSummary,
    getProgressStatusLabel,
    getProgressStatusVariant,
    getListStatusVariant,
  };
}
