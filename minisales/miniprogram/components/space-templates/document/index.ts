Component({
    properties: {
        space: { type: Object, value: null },
    },
    methods: {
        onItemTap(e: WechatMiniprogram.CustomEvent) {
            (this as any).triggerEvent('itemtap', e.currentTarget.dataset);
        },
    },
});
