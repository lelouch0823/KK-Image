Component({
  properties: {
    title: String,
    subtitle: String,
    showTabs: { type: Boolean, value: true },
    unreadCount: { type: Number, value: 0 },
    activeTab: { type: String, value: 'orders' },
    safeTop: { type: Number, value: 0 },
  },
  lifetimes: {
    ready() {
      this.emitLayout();
    },
  },
  methods: {
    emitLayout() {
      this.createSelectorQuery()
        .select('.shell')
        .boundingClientRect((rect) => {
          const box = rect as WechatMiniprogram.BoundingClientRectCallbackResult | null;
          if (box && box.height) {
            this.triggerEvent('layout', { height: box.height });
          }
        })
        .exec();
    },
    onTapOrders() {
      this.triggerEvent('navigate', { target: 'orders' });
    },
    onTapSpaces() {
      this.triggerEvent('navigate', { target: 'spaces' });
    },
    onTapStats() {
      this.triggerEvent('navigate', { target: 'stats' });
    },
    onTapNotifications() {
      this.triggerEvent('notifications');
    },
  },
});
