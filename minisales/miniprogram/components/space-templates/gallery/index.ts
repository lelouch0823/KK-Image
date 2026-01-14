Component({
    properties: {
        space: { type: Object, value: null },
        baseUrl: { type: String, value: '' },
    },
    methods: {
        onPreview(e: WechatMiniprogram.CustomEvent) {
            this.triggerEvent('preview', e.currentTarget.dataset);
        },
    },
});
