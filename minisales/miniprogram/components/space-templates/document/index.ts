Component({
    properties: {
        space: { type: Object, value: null },
        baseUrl: { type: String, value: '' },
    },
    methods: {
        onItemTap(e: WechatMiniprogram.CustomEvent) {
            this.triggerEvent('itemtap', e.currentTarget.dataset);
        },
    },
});
