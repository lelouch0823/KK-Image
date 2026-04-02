Component({
  properties: {
    loading: { type: Boolean, value: false },
    error: { type: String, value: '' },
    empty: { type: Boolean, value: false },
    emptyText: { type: String, value: '暂无数据' },
  },
  methods: {
    onRetry() {
      this.triggerEvent('retry');
    },
  },
});
