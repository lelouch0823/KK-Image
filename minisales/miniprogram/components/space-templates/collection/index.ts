Component({
    properties: {
        space: { type: Object, value: null },
    },
    methods: {
        onSubspaceTap(e: WechatMiniprogram.CustomEvent) {
            (this as any).triggerEvent('subspacetap', e.currentTarget.dataset);
        },
    },
});
