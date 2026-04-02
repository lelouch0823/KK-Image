interface NotificationItem {
  id: string;
  title?: string;
  content?: string;
  createdAt?: number;
  created_at?: number;
  unread?: boolean;
  isRead?: boolean;
  is_read?: number;
  orderId?: string;
  type?: string;
}

interface RenderNotificationItem extends NotificationItem {
  displayTime: string;
  isUnread: boolean;
}

function formatNotificationTime(value?: number): string {
  const timestamp = Number(value || 0);
  if (!timestamp) {
    return '';
  }

  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return '刚刚';
  }
  if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  }
  if (diff < day * 7) {
    return `${Math.floor(diff / day)}天前`;
  }

  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const dayText = `${date.getDate()}`.padStart(2, '0');
  return `${month}-${dayText}`;
}

function normalizeUnread(item: NotificationItem): boolean {
  if (typeof item.unread === 'boolean') {
    return item.unread;
  }
  if (typeof item.isRead === 'boolean') {
    return !item.isRead;
  }
  return Number(item.is_read) !== 1;
}

function normalizeNotifications(items: NotificationItem[]): RenderNotificationItem[] {
  return items.map((item) => {
    const createdAt = Number(item.createdAt || item.created_at || 0);
    return {
      ...item,
      createdAt,
      created_at: createdAt,
      isUnread: normalizeUnread(item),
      displayTime: formatNotificationTime(createdAt),
    };
  });
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    notifications: { type: Array, value: [] },
    loading: { type: Boolean, value: false },
    error: { type: String, value: '' },
    unreadCount: { type: Number, value: 0 },
  },
  data: {
    renderList: [] as RenderNotificationItem[],
  },
  observers: {
    notifications(next: NotificationItem[]) {
      this.setData({ renderList: normalizeNotifications(next || []) });
    },
  },
  methods: {
    noop() {
      return;
    },
    onMaskTap() {
      this.triggerEvent('close');
    },
    onCloseTap() {
      this.triggerEvent('close');
    },
    onRetryTap() {
      this.triggerEvent('retry');
    },
    onMarkAllTap() {
      this.triggerEvent('markall');
    },
    onTapItem(e: WechatMiniprogram.TouchEvent) {
      const id = String(e.currentTarget.dataset.id || '');
      const item = this.data.renderList.find((entry) => entry.id === id);
      if (!item) {
        return;
      }

      this.triggerEvent('select', { notification: item });
    },
  },
});
