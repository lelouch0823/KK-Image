Component({
  properties: {
    loading: { type: Boolean, value: false },
    error: { type: String, value: '' },
    empty: { type: Boolean, value: false },
    emptyText: { type: String, value: '暂无数据' },
    surface: { type: String, value: 'card' },
  },
  data: {
    surfaceClass: 'sales-surface-card',
  },
  observers: {
    surface(next: string) {
      this.setData({
        surfaceClass: next === 'soft' ? 'sales-surface-soft' : 'sales-surface-card',
      });
    },
  },
  methods: {
    onRetry() {
      this.triggerEvent('retry');
    },
  },
});
