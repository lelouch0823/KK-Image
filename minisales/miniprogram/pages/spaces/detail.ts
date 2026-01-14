/**
 * 共享空间详情页
 * 支持 6 种模板: gallery, product, portfolio, document, collection, custom
 */

import { get, getAccessToken } from '../../utils/api';
import { API, API_BASE_URL } from '../../utils/constants';

interface SpaceFile {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    width?: number;
    height?: number;
    section?: string;
}

interface Subspace {
    id: string;
    name: string;
    fileCount: number;
    coverUrl?: string;
}

interface SpaceDetail {
    id: string;
    name: string;
    description: string;
    template: string;
    templateData: Record<string, any> | null;
    files: SpaceFile[];
    subspaces?: Subspace[];
}

Page({
    data: {
        space: null as SpaceDetail | null,
        loading: true,
        baseUrl: API_BASE_URL,
        currentIndex: 0,
    },

    onLoad(options: { id?: string }) {
        if (options.id) {
            this.loadSpaceDetail(options.id);
        } else {
            wx.showToast({ title: '参数错误', icon: 'none' });
            setTimeout(() => wx.navigateBack(), 1500);
        }
    },

    /**
     * 加载空间详情
     */
    async loadSpaceDetail(spaceId: string) {
        const accessToken = getAccessToken();
        if (!accessToken) {
            wx.redirectTo({ url: '/pages/login/login' });
            return;
        }

        this.setData({ loading: true });

        try {
            const response = await get<SpaceDetail>(API.SALES_SPACE_DETAIL(accessToken, spaceId));

            if (response.success && response.data) {
                const data = response.data;
                if (!data.templateData) {
                    data.templateData = {};
                }
                this.setData({ space: data });
            } else {
                wx.showToast({ title: '加载失败', icon: 'none' });
            }
        } catch (error) {
            console.error('Load space detail failed:', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            this.setData({ loading: false });
        }
    },

    /**
     * 轮播图切换 (from template components)
     */
    onSwiperChange(e: WechatMiniprogram.CustomEvent) {
        this.setData({ currentIndex: e.detail.current });
    },

    /**
     * 预览图片 (from template components)
     */
    handlePreview(e: WechatMiniprogram.CustomEvent) {
        const { url } = e.detail;
        const { space, baseUrl } = this.data;
        if (!space) return;

        const urls = space.files.map((f) => `${baseUrl}${f.url}`);
        wx.previewImage({ current: url, urls });
    },

    /**
     * 预览图片 (default template)
     */
    previewImage(e: WechatMiniprogram.CustomEvent) {
        const { url } = e.currentTarget.dataset;
        const { space, baseUrl } = this.data;
        if (!space) return;

        const urls = space.files.map((f) => `${baseUrl}${f.url}`);
        wx.previewImage({ current: url, urls });
    },

    /**
     * 文档模板项目点击 (预览或下载)
     */
    handleDocumentItem(e: WechatMiniprogram.CustomEvent) {
        const { url, index } = e.detail;
        const { space, baseUrl } = this.data;
        if (!space) return;

        const file = space.files[index];
        if (file.mimeType.includes('image')) {
            const urls = space.files.map((f) => `${baseUrl}${f.url}`);
            wx.previewImage({ current: url, urls });
        } else {
            wx.downloadFile({
                url: `${baseUrl}${file.url}`,
                success: (res) => {
                    if (res.statusCode === 200) {
                        wx.openDocument({
                            filePath: res.tempFilePath,
                            showMenu: true,
                            fail: () => wx.showToast({ title: '无法打开此类型文件', icon: 'none' }),
                        });
                    }
                },
                fail: () => wx.showToast({ title: '下载失败', icon: 'none' }),
            });
        }
    },

    /**
     * 查看子空间 (collection 模板)
     */
    handleViewSubspace(e: WechatMiniprogram.CustomEvent) {
        const { id } = e.detail;
        wx.navigateTo({ url: `/pages/spaces/detail?id=${id}` });
    },

    /**
     * 返回
     */
    handleBack() {
        wx.navigateBack();
    },
});
