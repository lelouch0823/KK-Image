Component({
    properties: {
        space: { type: Object, value: null },
        baseUrl: { type: String, value: '' },
        currentIndex: { type: Number, value: 0 },
    },
    methods: {
        onSwiperChange(e: WechatMiniprogram.SwiperChange) {
            this.triggerEvent('swiperchange', { current: e.detail.current });
        },
        onPreview(e: WechatMiniprogram.CustomEvent) {
            this.triggerEvent('preview', e.currentTarget.dataset);
        },
    },
});
