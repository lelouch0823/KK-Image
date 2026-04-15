import { resolveStatusConfig, type OrderStatusTone } from '../../../utils/constants';

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
      value: undefined,
    },
  },
  data: {
    statusLabel: '',
    statusTone: 'neutral',
    timeText: '',
  },
  observers: {
    order(order?: OrderCardItem) {
      if (!order) {
        this.setData({
          statusLabel: '',
          statusTone: 'neutral',
          timeText: '',
        });
        return;
      }

      const meta = resolveStatusConfig(order.status);
      const timeValue = order.updatedAt || order.createdAt;
      this.setData({
        statusLabel: meta.label,
        statusTone: meta.tone as OrderStatusTone,
        timeText: formatRelativeTime(timeValue),
      });
    },
  },
  methods: {
    onTap() {
      const order = this.properties.order as OrderCardItem | undefined;
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
