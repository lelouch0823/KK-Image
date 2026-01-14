Component({
    properties: {
        space: { type: Object, value: null },
        baseUrl: { type: String, value: '' },
    },
    methods: {
        onSubspaceTap(e: WechatMiniprogram.CustomEvent) {
            this.triggerEvent('subspacetap', e.currentTarget.dataset);
        },
    },
});
