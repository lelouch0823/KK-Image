/**
 * 导航栏组件
 */
Component({
    options: {
        styleIsolation: 'shared', // 允许使用全局样式变量
    },

    properties: {
        title: {
            type: String,
            value: '',
        },
        showBack: {
            type: Boolean,
            value: true,
        },
        actionText: {
            type: String,
            value: '',
        },
    },

    data: {
        statusBarHeight: 20,
        navContentHeight: 44,
        headerHeight: 64,
    },

    lifetimes: {
        attached() {
            const sysInfo = wx.getSystemInfoSync();
            const menuInfo = wx.getMenuButtonBoundingClientRect();

            const statusBarHeight = sysInfo.statusBarHeight;
            const navContentHeight = (menuInfo.top - statusBarHeight) * 2 + menuInfo.height;
            const headerHeight = statusBarHeight + navContentHeight;

            this.setData({
                statusBarHeight,
                navContentHeight,
                headerHeight,
            });
        },
    },

    methods: {
        handleBack() {
            if (this.data.showBack) {
                this.triggerEvent('back');
                wx.navigateBack();
            }
        },

        handleAction() {
            if (this.data.actionText) {
                this.triggerEvent('action');
            }
        },
    },
});
