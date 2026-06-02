import { getAccessToken } from '../../utils/api';
import { handleMissingAccessToken } from '../../services/auth/session';
import { lookupProductByBarcode } from '../../services/sales/products';
import type { NormalizedSalesProductSummary } from '../../utils/normalize/product';
import { buildScanResultViewModel, type ScanResult } from './controller';

type PageState = 'idle' | 'scanning' | 'loading' | 'result' | 'not_found' | 'error';

Page({
  data: {
    state: 'idle' as PageState,
    scanCode: '',
    product: null as NormalizedSalesProductSummary | null,
    viewModel: null as ReturnType<typeof buildScanResultViewModel> | null,
    adjustQuantity: 1,
    adjustDirection: 'in' as 'in' | 'out',
    adjustRemark: '',
    errorMessage: '',
  },

  onLoad() {
    // 页面加载时不自动开始扫码，等待用户点击
  },

  handleStartScan() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['barCode', 'qrCode', 'datamatrix', 'pdf417'],
      success: (res) => {
        const scanCode = String(res.result || '');
        if (!scanCode) {
          wx.showToast({ title: '未识别到条码', icon: 'none' });
          return;
        }
        this.setData({ scanCode });
        void this.lookupProduct(scanCode);
      },
      fail: () => {
        wx.showToast({ title: '扫码取消', icon: 'none' });
      },
    });
  },

  async lookupProduct(scanCode: string) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    this.setData({ state: 'loading', errorMessage: '' });

    try {
      const result = await lookupProductByBarcode({ accessToken, barcode: scanCode });

      if (!result.success) {
        this.setData({
          state: 'error',
          errorMessage: result.error || '查询失败',
        });
        return;
      }

      if (!result.data) {
        this.setData({
          state: 'not_found',
          product: null,
          viewModel: buildScanResultViewModel({ scanCode, product: null, matched: false }),
        });
        return;
      }

      const scanResult: ScanResult = {
        scanCode,
        product: result.data,
        matched: true,
      };

      this.setData({
        state: 'result',
        product: result.data,
        viewModel: buildScanResultViewModel(scanResult),
      });
    } catch (_error) {
      this.setData({
        state: 'error',
        errorMessage: '查询失败',
      });
    }
  },

  onQuantityInput(e: WechatMiniprogram.CustomEvent<{ value?: string | number }>) {
    const value = Number(e.detail?.value || 1);
    this.setData({
      adjustQuantity: Math.max(1, value),
    });
  },

  onDirectionChange(e: WechatMiniprogram.TouchEvent) {
    const direction = String(e.currentTarget?.dataset?.direction || 'in') as 'in' | 'out';
    this.setData({ adjustDirection: direction });
  },

  onRemarkInput(e: WechatMiniprogram.CustomEvent<{ value?: string }>) {
    this.setData({
      adjustRemark: String(e.detail?.value || ''),
    });
  },

  handleCreateOrder() {
    if (!this.data.product) {
      return;
    }

    const product = this.data.product;
    const prefill = encodeURIComponent(JSON.stringify({
      name: product.name || '',
      brand: product.brand || '',
      series: product.series || '',
      sku: product.spu || '',
      productId: product.id || '',
      quantity: this.data.adjustQuantity,
    }));

    wx.navigateTo({
      url: `/pages/form/form?prefill=${prefill}`,
    });
  },

  handleScanAgain() {
    this.setData({
      state: 'idle',
      scanCode: '',
      product: null,
      viewModel: null,
      adjustQuantity: 1,
      adjustDirection: 'in',
      adjustRemark: '',
      errorMessage: '',
    });
  },

  handleRetry() {
    if (this.data.scanCode) {
      void this.lookupProduct(this.data.scanCode);
    } else {
      this.handleStartScan();
    }
  },

  handleBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/index/index' });
      },
    });
  },
});
