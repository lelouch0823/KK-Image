interface OrderCardItem {
  id: string;
  orderNo: string;
  title: string;
  status: string;
  createdAt?: number;
  updatedAt?: number;
  imageUrl?: string;
  hasNewFeedback?: boolean;
}

const STATUS_META: Record<string, { label: string; color: string; background: string }> = {
  pending: { label: '待确认', color: '#b45309', background: '#fef3c7' },
  confirmed: { label: '已确认', color: '#1d4ed8', background: '#dbeafe' },
  rejected: { label: '已驳回', color: '#b91c1c', background: '#fee2e2' },
  production: { label: '生产中', color: '#6d28d9', background: '#ede9fe' },
  shipping: { label: '已发货', color: '#0e7490', background: '#cffafe' },
  arrived: { label: '已到店', color: '#047857', background: '#d1fae5' },
  delivered: { label: '已交付', color: '#15803d', background: '#dcfce7' },
  void: { label: '已作废', color: '#4b5563', background: '#e5e7eb' },
  partially_received: { label: '部分到货', color: '#92400e', background: '#fde68a' },
  received: { label: '已到货', color: '#047857', background: '#d1fae5' },
};

function resolveStatusMeta(status?: string) {
  if (status && STATUS_META[status]) {
    return STATUS_META[status];
  }

  return {
    label: status || '处理中',
    color: '#334155',
    background: '#e2e8f0',
  };
}

function formatRelativeTime(value?: number): string {
  const timestamp = Number(value || 0);
  if (!timestamp) {
    return '';
  }

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return '刚刚';
  }
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}小时前`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}天前`;
  }

  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${month}-${day}`;
}

Component({
  properties: {
    order: {
      type: Object,
      value: null,
    },
  },
  data: {
    statusLabel: '',
    statusStyle: '',
    timeText: '',
  },
  observers: {
    order(order: OrderCardItem | null) {
      if (!order) {
        this.setData({
          statusLabel: '',
          statusStyle: '',
          timeText: '',
        });
        return;
      }

      const meta = resolveStatusMeta(order.status);
      const timeValue = order.updatedAt || order.createdAt;
      this.setData({
        statusLabel: meta.label,
        statusStyle: `color:${meta.color};background:${meta.background};`,
        timeText: formatRelativeTime(timeValue),
      });
    },
  },
  methods: {
    onTap() {
      const order = this.properties.order as OrderCardItem | null;
      if (!order || !order.id) {
        return;
      }
      this.triggerEvent('view', {
        id: order.id,
        order,
      });
    },
  },
});
