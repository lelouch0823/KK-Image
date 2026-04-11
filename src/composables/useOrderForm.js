/**
 * 订单表单 Composable
 * 提供订单表单的状态管理、验证和提交逻辑
 *
 * @file src/composables/useOrderForm.js
 */

import { ref, reactive, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useRecentInputs } from '@/composables/useRecentInputs';
import { useSalesToken } from '@/composables/useSalesToken';
import { getTodayISOString } from '@/utils/common';
import { API } from '@/utils/constants';

/**
 * 订单表单 Composable
 * @param {Object} options - 配置选项
 * @param {Object|null} options.prefill - 预填充数据 (用于复制订单)
 * @param {Object} options.submitProgress - 提交进度 { step, current, total }
 * @returns {Object} 表单状态和方法
 */
export function useOrderForm(options = {}) {
  const { t } = useI18n();

  // ========== 表单状态 ==========
  const form = reactive({
    name: '',
    brand: '',
    series: '',
    sku: '',
    color: '',
    material: '',
    size: '',
    quantity: 1,
    remark: '',
    deadline: '',
  });

  const uploadedFiles = ref([]);
  const isSubmitting = ref(false);

  // ========== 计算属性 ==========
  const minDate = computed(() => getTodayISOString());

  // 最近输入历史
  const { getRecent, saveMultiple } = useRecentInputs('order');
  const nameSuggestions = computed(() => getRecent('name'));
  const brandSuggestions = computed(() => getRecent('brand'));
  const seriesSuggestions = computed(() => getRecent('series'));
  const colorSuggestions = computed(() => getRecent('color'));
  const materialSuggestions = computed(() => getRecent('material'));

  // 上传地址
  const { token: salesToken } = useSalesToken();
  const uploadEndpoint = computed(() => {
    // 默认为销售模式，明确传入 isSalesMode=false 才切换为管理端地址
    const isSales = options.isSalesMode !== false;
    if (!isSales) {
      return API.MANAGE_UPLOAD;
    }
    return API.SALES_UPLOAD(salesToken.value || '');
  });

  // 表单是否有效
  const isValid = computed(() => {
    return !!form.name && uploadedFiles.value.length > 0;
  });

  // 进度文本
  const progressText = computed(() => {
    const { step, current, total } = options.submitProgress?.value || {};
    if (step === 'creating') return t('order.form.stepCreating');
    if (step === 'uploading') return t('order.form.stepUploading', { current, total });
    if (step === 'linking') return t('order.form.stepLinking');
    if (isSubmitting.value) return t('order.form.submitting');
    return t('order.form.submit');
  });

  // ========== 方法 ==========

  /**
   * 填充表单数据 (用于复制订单)
   * @param {Object} data - 预填充数据
   */
  const resetFormState = () => {
    Object.keys(form).forEach((key) => {
      if (key === 'quantity') {
        form[key] = 1;
      } else {
        form[key] = '';
      }
    });
    uploadedFiles.value = [];
  };

  const fillForm = (data) => {
    resetFormState();

    if (!data) {
      return;
    }

    // 填充表单字段
    Object.keys(form).forEach((key) => {
      if (data[key] !== undefined) {
        form[key] = data[key];
      }
    });

    // 填充图片列表
    if (data.files && data.files.length > 0) {
      uploadedFiles.value = data.files.map((f) => ({
        id: f.id,
        name: f.name,
        url: f.url,
        mimeType: f.mimeType,
        size: f.size,
        isLocal: false,
      }));
    }
  };

  /**
   * 获取提交数据
   * @returns {Object} 包含表单数据和文件ID列表
   */
  const getSubmitData = () => {
    // 提取所有已上传的文件ID
    const fileIds = uploadedFiles.value
      .filter((f) => !f.isLocal && f.id)
      .map((f) => f.id);

    return {
      ...form,
      fileIds,
    };
  };

  /**
   * 保存输入历史
   */
  const saveHistory = () => {
    saveMultiple({
      name: form.name,
      brand: form.brand,
      series: form.series,
      color: form.color,
      material: form.material,
      quantity: form.quantity,
    });
  };

  /**
   * 设置提交状态
   * @param {boolean} value
   */
  const setSubmitting = (value) => {
    isSubmitting.value = value;
  };

  return {
    // 状态
    form,
    uploadedFiles,
    isSubmitting,

    // 计算属性
    minDate,
    isValid,
    progressText,
    uploadEndpoint,

    // 自动补全建议
    nameSuggestions,
    brandSuggestions,
    seriesSuggestions,
    colorSuggestions,
    materialSuggestions,

    // 方法
    fillForm,
    getSubmitData,
    saveHistory,
    setSubmitting,
  };
}
