Component({
    properties: {
        space: { type: Object, value: undefined },
    },
    methods: {
        onSwiperChange(e: WechatMiniprogram.SwiperChange) {
            (this as any).triggerEvent('swiperchange', { current: e.detail.current });
        },
        onItemTap(e: WechatMiniprogram.CustomEvent) {
            (this as any).triggerEvent('itemtap', e.currentTarget.dataset);
        },
        onPreview(e: WechatMiniprogram.CustomEvent) {
            (this as any).triggerEvent('preview', e.currentTarget.dataset);
        },
    },
});
