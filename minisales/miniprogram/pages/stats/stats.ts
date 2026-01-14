/**
 * 个人统计页
 */

import { get, getAccessToken } from '../../utils/api';
import { API } from '../../utils/constants';
import { getCurrentUser } from '../../utils/auth';

interface Stats {
    totalOrders: number;
    completedOrders: number;
    monthOrders: number;
    monthlyTrend: Array<{ date: string; count: number }>;
}

Page({
    data: {
        stats: {
            totalOrders: 0,
            completedOrders: 0,
            monthOrders: 0,
            monthlyTrend: [],
        } as Stats,
        loading: true,
        user: null as { name: string; store?: string } | null,
        maxCount: 1,

        // 导航栏布局信息
        statusBarHeight: 20,
        navContentHeight: 44,
        headerHeight: 64,
    },

    onLoad() {
        const user = getCurrentUser();
        this.setData({ user });

        // 计算自定义导航栏高度
        const sysInfo = wx.getSystemInfoSync();
        const menuInfo = wx.getMenuButtonBoundingClientRect();

        const statusBarHeight = sysInfo.statusBarHeight;
        const navContentHeight = (menuInfo.top - statusBarHeight) * 2 + menuInfo.height;

        this.setData({
            statusBarHeight,
            navContentHeight,
            headerHeight: statusBarHeight + navContentHeight,
        });
    },

    onShow() {
        this.loadStats();
    },

    /**
     * 下拉刷新
     */
    async onPullDownRefresh() {
        await this.loadStats();
        wx.stopPullDownRefresh();
    },

    /**
     * 加载统计数据
     */
    async loadStats() {
        const accessToken = getAccessToken();
        if (!accessToken) return;

        this.setData({ loading: true });

        try {
            const response = await get<Stats>(API.SALES_STATS(accessToken));

            if (response.success && response.data) {
                const stats = response.data;
                const maxCount = Math.max(...stats.monthlyTrend.map((d) => d.count), 1);
                this.setData({ stats, maxCount });
            }
        } catch (error) {
            console.error('Load stats failed:', error);
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 计算柱形高度百分比
     */
    getBarHeight(count: number): string {
        const { maxCount } = this.data;
        return `${Math.max(10, (count / maxCount) * 100)}%`;
    },
});
