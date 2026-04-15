Component({
    properties: {
        space: { type: Object, value: undefined },
        currentIndex: { type: Number, value: 0 },
    },
    methods: {
        onSwiperChange(e: WechatMiniprogram.SwiperChange) {
            (this as any).triggerEvent('swiperchange', { current: e.detail.current });
        },
        onPreview(e: WechatMiniprogram.CustomEvent) {
            (this as any).triggerEvent('preview', e.currentTarget.dataset);
        },
    },
});
