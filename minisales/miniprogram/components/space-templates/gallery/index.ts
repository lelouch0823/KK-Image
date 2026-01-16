Component({
    properties: {
        space: { type: Object, value: null },
    },
    methods: {
        onPreview(e: WechatMiniprogram.CustomEvent) {
            (this as any).triggerEvent('preview', e.currentTarget.dataset);
        },
    },
});
