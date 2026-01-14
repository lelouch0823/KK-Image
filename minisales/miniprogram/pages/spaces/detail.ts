/**
 * 共享空间详情页
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
}

interface SpaceDetail {
    id: string;
    name: string;
    description: string;
    files: SpaceFile[];
}

Page({
    data: {
        space: null as SpaceDetail | null,
        loading: true,
        baseUrl: API_BASE_URL,
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
                this.setData({ space: response.data });
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
     * 预览图片
     */
    previewImage(e: WechatMiniprogram.CustomEvent) {
        const { url } = e.currentTarget.dataset;
        const { space, baseUrl } = this.data;
        if (!space) return;

        const urls = space.files.map((f) => `${baseUrl}${f.url}`);
        wx.previewImage({
            current: url,
            urls,
        });
    },

    /**
     * 返回
     */
    handleBack() {
        wx.navigateBack();
    },
});
