import { getAccessToken } from '../../utils/api';
import {
  addSalesOrderComment,
  loadSalesOrderDetail,
  markSalesOrderRead,
} from '../../services/sales/orders';
import { handleMissingAccessToken } from '../../services/auth/session';
import type { NormalizedSalesOrderDetail } from '../../utils/normalize/order';
import {
  buildDuplicatePrefill,
  buildOrderDetailViewModel,
  type DuplicatePrefill,
  type OrderDetailViewModel,
} from './controller';

type PageState = 'loading' | 'ready' | 'error';

function normalizeInputValue(event: WechatMiniprogram.CustomEvent<{ value?: string }> | any): string {
  const detail = event?.detail;
  if (typeof detail?.value === 'string') {
    return detail.value;
  }
  if (typeof detail === 'string') {
    return detail;
  }
  return '';
}

Page({
  data: {
    state: 'loading' as PageState,
    errorMessage: '',
    detail: null as NormalizedSalesOrderDetail | null,
    viewModel: null as OrderDetailViewModel | null,
    duplicatePrefill: null as DuplicatePrefill | null,
    comment: '',
    canSubmitComment: false,
    commentError: '',
    submittingComment: false,
  },

  currentOrderId: '',

  onLoad(options: { id?: string }) {
    const orderId = String(options.id || '');
    if (!orderId) {
      this.setData({
        state: 'error',
        errorMessage: '缺少订单编号',
      });
      return;
    }

    this.currentOrderId = orderId;
    void this.loadOrderDetail(orderId);
  },

  getImageUrls() {
    const urls = (this.data.viewModel?.files || [])
      .filter((item) => item.isImage)
      .map((item) => item.url);

    const mainImage = this.data.viewModel?.summary?.mainImage || '';
    if (mainImage && !urls.includes(mainImage)) {
      urls.unshift(mainImage);
    }

    return urls;
  },

  openImagePreview(current: string) {
    const urls = this.getImageUrls();
    if (!current || urls.length === 0) {
      return;
    }

    wx.previewImage({
      current,
      urls,
    });
  },

  async loadOrderDetail(orderId: string, options: { silent?: boolean } = {}) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return false;
    }

    const silent = Boolean(options.silent);
    if (!silent || !this.data.viewModel) {
      this.setData({
        state: 'loading',
        errorMessage: '',
      });
    }

    try {
      const result = await loadSalesOrderDetail({ accessToken, orderId });
      if (!result.success || !result.data) {
        const errorMessage = result.error || '加载失败';
        if (silent && this.data.viewModel) {
          wx.showToast({ title: errorMessage, icon: 'none' });
          return false;
        }

        this.setData({
          state: 'error',
          errorMessage,
        });
        return false;
      }

      const detail = result.data;
      this.setData({
        state: 'ready',
        errorMessage: '',
        detail,
        viewModel: buildOrderDetailViewModel(detail),
        duplicatePrefill: buildDuplicatePrefill(detail),
      });

      void this.markOrderAsRead(detail);
      return true;
    } catch (_error) {
      if (silent && this.data.viewModel) {
        wx.showToast({ title: '刷新失败', icon: 'none' });
        return false;
      }

      this.setData({
        state: 'error',
        errorMessage: '加载失败',
      });
      return false;
    }
  },

  async loadOrder(orderId: string) {
    return this.loadOrderDetail(orderId);
  },

  async markOrderAsRead(detail: NormalizedSalesOrderDetail) {
    if (!detail.id || (!detail.unreadBySales && !detail.unreadByAdmin)) {
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      return;
    }

    const result = await markSalesOrderRead({
      accessToken,
      orderId: detail.id,
    });

    if (result.success && this.data.detail?.id === detail.id) {
      this.setData({
        'detail.unreadBySales': false,
        'detail.unreadByAdmin': false,
      });
    }
  },

  onCommentInput(e: WechatMiniprogram.CustomEvent<{ value?: string }>) {
    const comment = normalizeInputValue(e);
    this.setData({
      comment,
      canSubmitComment: Boolean(comment.trim()),
      commentError: '',
    });
  },

  async handleSubmitComment() {
    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    const comment = this.data.comment.trim();
    if (!comment || !this.currentOrderId || this.data.submittingComment) {
      return;
    }

    this.setData({
      submittingComment: true,
      commentError: '',
    });

    try {
      const result = await addSalesOrderComment({
        accessToken,
        orderId: this.currentOrderId,
        comment,
      });

      if (!result.success) {
        this.setData({
          commentError: result.error || '留言失败',
        });
        return;
      }

      this.setData({
        comment: '',
        canSubmitComment: false,
        commentError: '',
      });
      wx.showToast({ title: '留言成功', icon: 'success' });
      await this.loadOrderDetail(this.currentOrderId, { silent: true });
    } catch (_error) {
      this.setData({
        commentError: '留言失败',
      });
    } finally {
      this.setData({
        submittingComment: false,
      });
    }
  },

  onSummaryPreview(e: WechatMiniprogram.CustomEvent<{ url?: string }>) {
    const url = String(e.detail?.url || '');
    this.openImagePreview(url);
  },

  onFileTap(e: WechatMiniprogram.TouchEvent) {
    const url = String(e.currentTarget.dataset.url || '');
    const previewable = Boolean(e.currentTarget.dataset.previewable);

    if (!previewable) {
      wx.showToast({
        title: '当前文件暂不支持预览',
        icon: 'none',
      });
      return;
    }

    this.openImagePreview(url);
  },

  handleDuplicate() {
    if (!this.data.duplicatePrefill) {
      return;
    }

    const prefill = encodeURIComponent(JSON.stringify(this.data.duplicatePrefill));
    wx.navigateTo({
      url: `/pages/form/form?prefill=${prefill}`,
    });
  },

  handleRetry() {
    if (!this.currentOrderId) {
      return;
    }

    void this.loadOrderDetail(this.currentOrderId);
  },

  handleBack() {
    wx.navigateBack();
  },
});
