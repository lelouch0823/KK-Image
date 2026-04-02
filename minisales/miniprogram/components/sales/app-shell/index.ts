Component({
  properties: {
    title: String,
    subtitle: String,
    showTabs: { type: Boolean, value: true },
    unreadCount: { type: Number, value: 0 },
    activeTab: { type: String, value: 'orders' },
    safeTop: { type: Number, value: 0 },
    enableNotificationsDrawer: { type: Boolean, value: false },
    notifications: { type: Array, value: [] },
    notificationsLoading: { type: Boolean, value: false },
    notificationsError: { type: String, value: '' },
  },
  data: {
    drawerVisible: false,
  },
  lifetimes: {
    ready() {
      this.emitLayout();
    },
  },
  methods: {
    closeDrawer() {
      if (!this.data.drawerVisible) {
        return;
      }
      this.setData({ drawerVisible: false });
    },
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
      this.closeDrawer();
      this.triggerEvent('navigate', { target: 'orders' });
    },
    onTapSpaces() {
      this.closeDrawer();
      this.triggerEvent('navigate', { target: 'spaces' });
    },
    onTapStats() {
      this.closeDrawer();
      this.triggerEvent('navigate', { target: 'stats' });
    },
    onTapNotifications() {
      if (!this.properties.enableNotificationsDrawer) {
        this.triggerEvent('notifications');
        return;
      }

      const nextVisible = !this.data.drawerVisible;
      this.setData({ drawerVisible: nextVisible });
      this.triggerEvent('notifications', { open: nextVisible });
    },
    onDrawerClose() {
      this.closeDrawer();
      this.triggerEvent('notifications', { open: false });
    },
    onDrawerRetry() {
      this.triggerEvent('notificationretry');
    },
    onDrawerMarkAll() {
      this.triggerEvent('notificationmarkall');
    },
    onDrawerSelect(e: WechatMiniprogram.CustomEvent<{ notification?: Record<string, unknown> }>) {
      this.closeDrawer();
      this.triggerEvent('notificationselect', e.detail || {});
    },
  },
});
