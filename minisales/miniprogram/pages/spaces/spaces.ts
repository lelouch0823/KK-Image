/**
 * 共享空间列表页 - 小红书风格瀑布流
 */

import { get, getAccessToken } from '../../utils/api';
import { API, API_BASE_URL } from '../../utils/constants';

interface Space {
    id: string;
    name: string;
    description: string;
    template: string;
    fileCount: number;
    coverUrl: string | null;
    updatedAt: number;
    // 计算属性
    templateName?: string;
    aspectRatio?: number;
}

// 模板名称映射
const TEMPLATE_NAMES: Record<string, string> = {
    gallery: '画廊',
    product: '商品',
    portfolio: '作品集',
    document: '文档',
    collection: '合集',
    custom: '自定义',
};

Page({
    data: {
        spaces: [] as Space[],
        leftColumn: [] as Space[],
        rightColumn: [] as Space[],
        loading: true,
        baseUrl: API_BASE_URL,
        // Navbar auto-hide logic
        navBarHeight: 88, // Default fallback (rpx)
        navBarVisible: true,
        lastScrollTop: 0,
    },

    onLoad() {
        // Calculate navbar height (Status Bar + 44px)
        const systemInfo = wx.getSystemInfoSync();
        const statusBarHeight = systemInfo.statusBarHeight || 20;
        // Convert px to rpx for consistent usage if needed, but styling usually uses px for dynamic vars
        // Here we use px for the style binding
        this.setData({
            navBarHeight: statusBarHeight + 44, // 44 is standard nav height
        });
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
     * Handle Scroll for Auto-hiding Navbar
     */
    onScroll(e: WechatMiniprogram.ScrollViewScroll) {
        const scrollTop = e.detail.scrollTop;
        const { lastScrollTop, navBarVisible, navBarHeight } = this.data;
        const SCROLL_THRESHOLD = 10; // Minimum delta to trigger

        // Always show if near top
        if (scrollTop < navBarHeight + 20) {
            if (!navBarVisible) this.setData({ navBarVisible: true });
            return;
        }

        const delta = scrollTop - lastScrollTop;

        if (Math.abs(delta) < SCROLL_THRESHOLD) return;

        // Scroll Down -> Hide
        if (delta > 0 && navBarVisible) {
            this.setData({ navBarVisible: false });
        }
        // Scroll Up -> Show
        else if (delta < 0 && !navBarVisible) {
            this.setData({ navBarVisible: true });
        }

        this.data.lastScrollTop = scrollTop;
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
                // 添加模板名称和随机宽高比
                const spaces = response.data.map((space) => ({
                    ...space,
                    templateName: TEMPLATE_NAMES[space.template] || space.template,
                    aspectRatio: space.coverUrl ? (0.8 + Math.random() * 0.6) : 1, // 0.8-1.4
                }));

                // 瀑布流分列（简单交替分配）
                const leftColumn: Space[] = [];
                const rightColumn: Space[] = [];

                spaces.forEach((space, index) => {
                    if (index % 2 === 0) {
                        leftColumn.push(space);
                    } else {
                        rightColumn.push(space);
                    }
                });

                this.setData({ spaces, leftColumn, rightColumn });
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
