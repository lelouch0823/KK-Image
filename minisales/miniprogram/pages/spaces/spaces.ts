import { get, getAccessToken, getFileUrl } from '../../utils/api';
import { API } from '../../utils/constants';
import { calculateNavBarHeight, getNavbarVisibility, initTabBar } from '../../utils/ui-helpers';

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
        navBarHeight: 88,
        navBarVisible: true,
        // Skeleton 配置
        spacesRowCol: [
            { width: '100%', height: '300rpx', borderRadius: '16rpx' },
            { width: '80%', height: '32rpx', marginTop: '16rpx' },
        ],
    },

    // 滚动状态记录
    lastScrollTop: 0,

    onLoad() {
        const { totalHeight } = calculateNavBarHeight();
        this.setData({
            navBarHeight: totalHeight,
        });
    },

    onShow() {
        initTabBar(this);
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
        const { navBarVisible, navBarHeight } = this.data;
        const lastScrollTop = this.lastScrollTop;

        const shouldShow = getNavbarVisibility(
            scrollTop,
            lastScrollTop,
            navBarVisible,
            navBarHeight
        );

        if (shouldShow !== null) {
            this.setData({ navBarVisible: shouldShow });
        }

        this.lastScrollTop = scrollTop;
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
                // 数据预处理
                const spaces = response.data.map((space) => ({
                    ...space,
                    coverUrl: getFileUrl(space.coverUrl || undefined),
                    templateName: TEMPLATE_NAMES[space.template] || space.template,
                    aspectRatio: space.coverUrl ? (0.8 + Math.random() * 0.6) : 1,
                }));

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
    handleViewSpace(e: WechatMiniprogram.TouchEvent) {
        const { id } = e.currentTarget.dataset;
        wx.navigateTo({ url: `/pages/spaces_detail/detail?id=${id}` });
    },
});
