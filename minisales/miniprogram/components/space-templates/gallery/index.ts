Component({
    properties: {
        space: { type: Object, value: undefined },
    },
    methods: {
        onPreview(e: WechatMiniprogram.CustomEvent) {
            (this as any).triggerEvent('preview', e.currentTarget.dataset);
        },
    },
});
