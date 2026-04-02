import { getAccessToken } from '../../utils/api';
import { handleMissingAccessToken } from '../../services/auth/session';
import { getSalesSpaceDetail } from '../../services/sales/spaces';
import {
  buildSpaceDetailViewModel,
  buildSpacePreviewUrls,
  type SpaceDetailViewModel,
} from './controller';

Page({
  data: {
    state: 'loading' as 'loading' | 'ready' | 'error',
    errorMessage: '',
    pageTitle: '资源详情',
    space: null as Record<string, unknown> | null,
    viewModel: null as SpaceDetailViewModel | null,
    currentIndex: 0,
  },

  currentSpaceId: '',

  onLoad(options: { id?: string }) {
    const spaceId = String(options.id || '');
    if (!spaceId) {
      this.setData({
        state: 'error',
        errorMessage: '缺少资源编号',
      });
      return;
    }

    this.currentSpaceId = spaceId;
    void this.loadSpaceDetail(spaceId);
  },

  async loadSpaceDetail(spaceId: string) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    this.setData({
      state: 'loading',
      errorMessage: '',
    });

    try {
      const result = await getSalesSpaceDetail({
        accessToken,
        spaceId,
      });

      if (!result.success || !result.data) {
        this.setData({
          state: 'error',
          errorMessage: result.error || '加载失败',
        });
        return;
      }

      const viewModel = buildSpaceDetailViewModel(result.data);
      this.setData({
        state: 'ready',
        pageTitle: viewModel.title,
        space: result.data as Record<string, unknown>,
        viewModel,
      });
    } catch (_error) {
      this.setData({
        state: 'error',
        errorMessage: '加载失败',
      });
    }
  },

  onSwiperChange(e: WechatMiniprogram.CustomEvent<{ current?: number }>) {
    this.setData({ currentIndex: Number(e.detail?.current || 0) });
  },

  previewByUrl(url: string) {
    if (!this.data.space || !url) {
      return;
    }

    const urls = buildSpacePreviewUrls(this.data.space);
    if (urls.length === 0) {
      return;
    }

    wx.previewImage({ current: url, urls });
  },

  handlePreview(e: WechatMiniprogram.CustomEvent<{ url?: string }>) {
    this.previewByUrl(String(e.detail?.url || ''));
  },

  previewImage(e: WechatMiniprogram.TouchEvent) {
    this.previewByUrl(String(e.currentTarget.dataset.url || ''));
  },

  handleDocumentItem(e: WechatMiniprogram.CustomEvent<{ url?: string; index?: number }>) {
    const index = Number(e.detail?.index ?? -1);
    const file = this.data.viewModel?.files[index];
    if (!file) {
      return;
    }

    if (file.isImage) {
      this.previewByUrl(String(e.detail?.url || file.url));
      return;
    }

    wx.downloadFile({
      url: file.url,
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
  },

  handleViewSubspace(e: WechatMiniprogram.CustomEvent<{ id?: string }>) {
    const id = String(e.detail?.id || '');
    if (!id) {
      return;
    }

    wx.navigateTo({ url: `/pages/spaces_detail/detail?id=${id}` });
  },

  handleRetry() {
    if (!this.currentSpaceId) {
      return;
    }
    void this.loadSpaceDetail(this.currentSpaceId);
  },

  handleBack() {
    wx.navigateBack();
  },
});
