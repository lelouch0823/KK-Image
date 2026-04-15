Component({
    properties: {
        space: { type: Object, value: undefined },
    },
    methods: {
        onSubspaceTap(e: WechatMiniprogram.CustomEvent) {
            (this as any).triggerEvent('subspacetap', e.currentTarget.dataset);
        },
    },
});
