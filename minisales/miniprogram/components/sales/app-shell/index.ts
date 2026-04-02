Component({
  properties: {
    title: String,
    subtitle: String,
    showTabs: { type: Boolean, value: true },
    unreadCount: { type: Number, value: 0 },
    activeTab: { type: String, value: 'orders' },
  },
  methods: {
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
