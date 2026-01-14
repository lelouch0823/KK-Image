/**
 * 登录页
 */

import { usernameLogin } from '../../utils/auth';

Page({
    data: {
        username: '',
        password: '',
        loading: false,
        error: '',
        showPasswordLogin: false,
    },

    onLoad() {
        // 直接显示登录表单
        this.setData({ showPasswordLogin: true });
    },

    /**
     * 登录处理
     */
    async handleLogin() {
        const { username, password } = this.data;

        if (!username.trim()) {
            this.setData({ error: '请输入手机号或姓名' });
            return;
        }

        if (!password.trim()) {
            this.setData({ error: '请输入密码' });
            return;
        }

        this.setData({ loading: true, error: '' });

        try {
            const result = await usernameLogin(username.trim(), password);

            if (result.success) {
                wx.showToast({ title: '登录成功', icon: 'success' });
                setTimeout(() => {
                    wx.switchTab({ url: '/pages/index/index' });
                }, 1000);
            } else {
                this.setData({ error: result.message || '登录失败' });
            }
        } catch (error: any) {
            this.setData({ error: error.message || '登录失败' });
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 输入事件
     */
    onUsernameInput(e: WechatMiniprogram.Input) {
        this.setData({ username: e.detail.value, error: '' });
    },

    onPasswordInput(e: WechatMiniprogram.Input) {
        this.setData({ password: e.detail.value, error: '' });
    },
});
