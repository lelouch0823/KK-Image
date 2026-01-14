Component({
    properties: {
        space: { type: Object, value: null },
        baseUrl: { type: String, value: '' },
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
