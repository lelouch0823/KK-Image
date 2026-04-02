import { getAccessToken, getFileUrl, uploadFile } from '../../utils/api';
import { API } from '../../utils/constants';
import { createSalesOrder } from '../../services/sales/orders';
import { handleMissingAccessToken } from '../../services/auth/session';
import { uploadManager } from '../../utils/upload-manager';
import {
  buildCreatePayload,
  canSubmitOrderForm,
  type BoundSalesProductValue,
} from './controller';

interface FormData {
  name: string;
  brand: string;
  series: string;
  sku: string;
  size: string;
  color: string;
  material: string;
  remark: string;
  deadline: string;
  quantity: number;
}

interface UploadFile {
  id?: string;
  url: string;
  name?: string;
  type?: 'image' | 'video';
  percent?: number;
  status?: 'loading' | 'reload' | 'failed' | 'done';
  isLocal?: boolean;
}

interface BoundProductValue extends BoundSalesProductValue {
  name?: string;
  brand?: string;
  series?: string;
  sku?: string;
  size?: string;
  color?: string;
  material?: string;
  variantLabel?: string;
  primaryImage?: string;
}

const FORM_UPLOAD_CONTEXT = 'current_form';

function getEventValue(event: WechatMiniprogram.CustomEvent<{ value?: string | number }> | any) {
  const detail = event?.detail;
  if (detail && typeof detail.value !== 'undefined') {
    return detail.value;
  }
  return detail ?? '';
}

Page({
  data: {
    salesToken: '',
    form: {
      name: '',
      brand: '',
      series: '',
      sku: '',
      size: '',
      color: '',
      material: '',
      remark: '',
      deadline: '',
      quantity: 1,
    } as FormData,
    boundProduct: null as BoundProductValue | null,
    fileList: [] as UploadFile[],
    submitting: false,
    dateVisible: false,
    minDate: new Date().getTime(),
    maxDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).getTime(),
  },

  onLoad(options: { prefill?: string }) {
    uploadManager.clearTasksByOrder(FORM_UPLOAD_CONTEXT);
    const salesToken = getAccessToken() || '';
    this.setData({ salesToken });

    if (!options.prefill) {
      return;
    }

    try {
      const prefill = JSON.parse(decodeURIComponent(options.prefill));
      const nextForm = {
        ...this.data.form,
        ...prefill,
        quantity: Number(prefill.quantity || this.data.form.quantity || 1),
      };

      const boundProduct = prefill.productId
        ? {
            productId: prefill.productId,
            variantId: prefill.variantId || '',
            name: prefill.name || '',
            brand: prefill.brand || '',
            series: prefill.series || '',
            sku: prefill.sku || '',
          }
        : null;

      this.setData({
        form: nextForm,
        boundProduct,
      });
    } catch (error) {
      console.error('Parse prefill failed:', error);
    }
  },

  onUnload() {
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload();
    }
  },

  onInput(e: WechatMiniprogram.CustomEvent<{ value?: string | number }>) {
    const field = String(e.currentTarget.dataset.field || '');
    const value = getEventValue(e);
    const nextValue = field === 'quantity'
      ? Math.max(1, Number(value || 1))
      : value;

    this.setData({
      [`form.${field}`]: nextValue,
    });
  },

  showDatePicker() {
    this.setData({ dateVisible: true });
  },

  hideDatePicker() {
    this.setData({ dateVisible: false });
  },

  onConfirmDate(e: WechatMiniprogram.CustomEvent<{ value?: string }>) {
    const value = String(getEventValue(e) || '');
    this.setData({
      'form.deadline': value,
      dateVisible: false,
    });
  },

  onProductBound(e: WechatMiniprogram.CustomEvent<{ value?: BoundProductValue }>) {
    const boundProduct = e.detail?.value || null;
    if (!boundProduct) {
      return;
    }

    const nextFiles = this.data.fileList.length > 0
      ? this.data.fileList
      : boundProduct.primaryImage
        ? [{
            url: boundProduct.primaryImage,
            name: boundProduct.name || '商品主图',
            status: 'done' as const,
            isLocal: false,
          }]
        : this.data.fileList;

    this.setData({
      boundProduct,
      fileList: nextFiles,
      form: {
        ...this.data.form,
        name: boundProduct.name || this.data.form.name,
        brand: boundProduct.brand || this.data.form.brand,
        series: boundProduct.series || this.data.form.series,
        sku: boundProduct.sku || this.data.form.sku,
        size: boundProduct.size || this.data.form.size,
        color: boundProduct.color || this.data.form.color,
        material: boundProduct.material || this.data.form.material,
      },
    });
  },

  onProductClear() {
    this.setData({ boundProduct: null });
  },

  handleAdd(e: WechatMiniprogram.CustomEvent<{ files?: UploadFile[] }>) {
    const files = e.detail?.files || [];
    const newFiles = files.map((file) => ({
      ...file,
      status: 'loading' as const,
      isLocal: true,
    }));

    this.setData({
      fileList: [...this.data.fileList, ...newFiles],
    });

    void this.processUpload(newFiles);
  },

  handleRemove(e: WechatMiniprogram.CustomEvent<{ index?: number }>) {
    const index = Number(e.detail?.index ?? -1);
    if (index < 0) {
      return;
    }

    const nextFiles = [...this.data.fileList];
    nextFiles.splice(index, 1);
    this.setData({ fileList: nextFiles });
  },

  async processUpload(files: UploadFile[]) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    if (wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({
        message: '图片正在上传中，退出可能导致上传中断，确定退出吗？',
      });
    }

    const uploadTasks = files.map(async (file) => {
      const index = this.data.fileList.findIndex((item) => item.url === file.url);
      if (index < 0) {
        return;
      }

      const taskId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      uploadManager.addTask(taskId, file.name || '图片', FORM_UPLOAD_CONTEXT);

      try {
        const result = await uploadFile<{ id: string; url: string }>(
          API.SALES_UPLOAD(accessToken),
          file.url
        );

        if (!result.success || !result.data) {
          throw new Error(result.error || result.message || '上传失败');
        }

        this.setData({
          [`fileList[${index}].status`]: 'done',
          [`fileList[${index}].url`]: getFileUrl(result.data.url),
          [`fileList[${index}].id`]: result.data.id,
        });
        uploadManager.setSuccess(taskId, result.data);
      } catch (error) {
        console.error('Upload item failed:', error);
        this.setData({
          [`fileList[${index}].status`]: 'failed',
        });
        uploadManager.setFailed(taskId, String(error));
      }
    });

    await Promise.all(uploadTasks);

    if (!this.data.fileList.some((item) => item.status === 'loading') && wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload();
    }
  },

  handleBack() {
    wx.navigateBack();
  },

  async handleSubmit() {
    const accessToken = getAccessToken();
    const toast = this.selectComponent('#t-toast');
    if (!accessToken) {
      handleMissingAccessToken();
      return;
    }

    if (!String(this.data.form.name || '').trim()) {
      toast.show({ content: '请输入商品名称', theme: 'warning' });
      return;
    }

    if (!canSubmitOrderForm(this.data.fileList)) {
      toast.show({ content: '图片上传中，请稍候', theme: 'warning' });
      return;
    }

    if (this.data.fileList.some((item) => item.status === 'failed')) {
      toast.show({ content: '存在上传失败的图片', theme: 'warning' });
      return;
    }

    this.setData({ submitting: true });

    try {
      const payload = buildCreatePayload({
        form: this.data.form,
        uploads: this.data.fileList,
        boundProduct: this.data.boundProduct,
      });

      const result = await createSalesOrder({
        accessToken,
        ...payload,
      });

      if (!result.success) {
        throw new Error(result.error || '创建失败');
      }

      uploadManager.clearTasksByOrder(FORM_UPLOAD_CONTEXT);
      if (wx.disableAlertBeforeUnload) {
        wx.disableAlertBeforeUnload();
      }
      toast.show({ content: '订单创建成功', theme: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 300);
    } catch (error: any) {
      toast.show({ content: error?.message || '提交失败', theme: 'error' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
