Component({
    properties: {
        space: { type: Object, value: undefined },
    },
    methods: {
        onItemTap(e: WechatMiniprogram.CustomEvent) {
            (this as any).triggerEvent('itemtap', e.currentTarget.dataset);
        },
    },
});
