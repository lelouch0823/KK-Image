/**
 * 共享空间列表页
 */

import { get, getAccessToken } from '../../utils/api';
import { API, API_BASE_URL } from '../../utils/constants';

interface Space {
    id: string;
    name: string;
    description: string;
    fileCount: number;
    coverUrl: string | null;
    updatedAt: number;
}

Page({
    data: {
        spaces: [] as Space[],
        loading: true,
        baseUrl: API_BASE_URL,
    },

    onLoad() {
        // 初始加载
    },

    onShow() {
        // 初始化 Tab Bar
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            (this.getTabBar() as any).init();
        }
        this.loadSpaces();
    },

    /**
     * 下拉刷新
     */
    async onPullDownRefresh() {
        await this.loadSpaces();
        wx.stopPullDownRefresh();
    },

    /**
     * 加载共享空间列表
     */
    async loadSpaces() {
        const accessToken = getAccessToken();
        if (!accessToken) {
            wx.redirectTo({ url: '/pages/login/login' });
            return;
        }

        this.setData({ loading: true });

        try {
            const response = await get<Space[]>(API.SALES_SPACES(accessToken));

            if (response.success && response.data) {
                this.setData({ spaces: response.data });
            }
        } catch (error) {
            console.error('Load spaces failed:', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 查看空间详情
     */
    handleViewSpace(e: WechatMiniprogram.CustomEvent) {
        const { id } = e.currentTarget.dataset;
        wx.navigateTo({ url: `/pages/spaces/detail?id=${id}` });
    },
});
