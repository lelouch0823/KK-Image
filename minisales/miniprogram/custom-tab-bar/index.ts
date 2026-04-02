Component({
    data: {
        value: '/pages/index/index',
    },

    methods: {
        onChange(e: WechatMiniprogram.CustomEvent) {
            const url = e.detail.value;
            wx.switchTab({ url });
            // update value immediately for better UX
            this.setData({ value: url });
        },

        init() {
            const page = getCurrentPages().pop();
            const route = page ? page.route : '';
            const value = `/${route}`;
            const tabValue = value === '/pages/spaces/spaces' ? value : '/pages/index/index';
            this.setData({ value: tabValue });
        },
    },
});
