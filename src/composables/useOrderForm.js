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

function normalizeLineText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function normalizeLineQuantity(value, fallback = 1) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

export function createEmptyOrderLine(overrides = {}) {
  return {
    name: '',
    brand: '',
    series: '',
    sku: '',
    size: '',
    color: '',
    material: '',
    quantity: 1,
    productId: null,
    variantId: null,
    boundProduct: null,
    boundProductVariant: null,
    ...overrides,
  };
}

function normalizeOrderLine(line = {}, fallback = {}) {
  return createEmptyOrderLine({
    name: normalizeLineText(line.name ?? line.productName, fallback.name || ''),
    brand: normalizeLineText(line.brand, fallback.brand || ''),
    series: normalizeLineText(line.series, fallback.series || ''),
    sku: normalizeLineText(line.sku, fallback.sku || ''),
    size: normalizeLineText(line.size, fallback.size || ''),
    color: normalizeLineText(line.color, fallback.color || ''),
    material: normalizeLineText(line.material, fallback.material || ''),
    quantity: normalizeLineQuantity(line.quantity ?? line.orderedQuantity, fallback.quantity || 1),
    productId: line.productId ?? fallback.productId ?? null,
    variantId: line.variantId ?? fallback.variantId ?? null,
    boundProduct: line.boundProduct ?? fallback.boundProduct ?? null,
    boundProductVariant: line.boundProductVariant ?? fallback.boundProductVariant ?? null,
  });
}

function isMeaningfulLine(line = {}) {
  return Boolean(
    line.productId ||
      line.variantId ||
      line.name ||
      line.brand ||
      line.series ||
      line.sku ||
      line.size ||
      line.color ||
      line.material
  );
}

function getLineCompletionState(line = {}) {
  if (!isMeaningfulLine(line)) {
    return {
      status: 'empty',
      tone: 'neutral',
      label: '空白行',
      isMeaningful: false,
      isSubmittable: false,
    };
  }

  if (normalizeLineText(line.name)) {
    return {
      status: 'ready',
      tone: line.productId || line.variantId ? 'success' : 'info',
      label: line.productId || line.variantId ? '已绑定' : '手工填写',
      isMeaningful: true,
      isSubmittable: true,
    };
  }

  return {
    status: 'pending',
    tone: 'warning',
    label: '待完善',
    message: '请填写商品名称或绑定商品',
    isMeaningful: true,
    isSubmittable: false,
  };
}

export function useOrderForm(options = {}) {
  const { t } = useI18n();

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
  const lines = ref([createEmptyOrderLine()]);

  const minDate = computed(() => getTodayISOString());

  const { getRecent, saveMultiple } = useRecentInputs('order');
  const nameSuggestions = computed(() => getRecent('name'));
  const brandSuggestions = computed(() => getRecent('brand'));
  const seriesSuggestions = computed(() => getRecent('series'));
  const colorSuggestions = computed(() => getRecent('color'));
  const materialSuggestions = computed(() => getRecent('material'));

  const { token: salesToken } = useSalesToken();
  const uploadEndpoint = computed(() => {
    const isSales = options.isSalesMode !== false;
    if (!isSales) {
      return API.MANAGE_UPLOAD;
    }
    return API.SALES_UPLOAD(salesToken.value || '');
  });

  const normalizedLineStates = computed(() =>
    lines.value.map((line) => {
      const normalized = normalizeOrderLine(line, form);
      return {
        line: normalized,
        completion: getLineCompletionState(normalized),
      };
    })
  );

  const summaryMetrics = computed(() => {
    let meaningfulLineCount = 0;
    let validLineCount = 0;
    let pendingLineCount = 0;
    let totalQuantity = 0;

    normalizedLineStates.value.forEach(({ line, completion }) => {
      if (!completion.isMeaningful) return;
      meaningfulLineCount += 1;
      totalQuantity += normalizeLineQuantity(line.quantity);
      if (completion.isSubmittable) {
        validLineCount += 1;
      } else {
        pendingLineCount += 1;
      }
    });

    return {
      lineCount: lines.value.length,
      meaningfulLineCount,
      validLineCount,
      pendingLineCount,
      totalQuantity,
      imageCount: uploadedFiles.value.length,
    };
  });

  const isValid = computed(
    () =>
      summaryMetrics.value.validLineCount > 0 &&
      summaryMetrics.value.pendingLineCount === 0 &&
      uploadedFiles.value.length > 0
  );

  const progressText = computed(() => {
    const { step, current, total } = options.submitProgress?.value || {};
    if (step === 'creating') return t('order.form.stepCreating');
    if (step === 'uploading') return t('order.form.stepUploading', { current, total });
    if (step === 'linking') return t('order.form.stepLinking');
    if (isSubmitting.value) return t('order.form.submitting');
    return t('order.form.submit');
  });

  const resetFormState = () => {
    Object.keys(form).forEach((key) => {
      form[key] = key === 'quantity' ? 1 : '';
    });
    uploadedFiles.value = [];
    lines.value = [createEmptyOrderLine()];
  };

  const fillForm = (data) => {
    resetFormState();

    if (!data) {
      return;
    }

    Object.keys(form).forEach((key) => {
      if (data[key] !== undefined) {
        form[key] = data[key];
      }
    });

    const rawLines = Array.isArray(data.lines) ? data.lines.filter(Boolean) : [];
    if (rawLines.length > 0) {
      lines.value = rawLines.map((line) => normalizeOrderLine(line, data));
    }

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

  const setLines = (nextLines = []) => {
    if (!Array.isArray(nextLines) || nextLines.length === 0) {
      lines.value = [createEmptyOrderLine()];
      return;
    }
    lines.value = nextLines.map((line) => normalizeOrderLine(line, form));
  };

  const updateLine = (index, nextLine) => {
    lines.value = lines.value.map((line, lineIndex) =>
      lineIndex === index ? normalizeOrderLine(nextLine, form) : line
    );
  };

  const addLineAfter = (index) => {
    const targetIndex = Number.isInteger(index) ? index : lines.value.length - 1;
    const nextLines = [...lines.value];
    nextLines.splice(targetIndex + 1, 0, createEmptyOrderLine());
    lines.value = nextLines;
  };

  const copyLine = (index) => {
    const source = normalizeOrderLine(lines.value[index], form);
    const nextLines = [...lines.value];
    nextLines.splice(
      index + 1,
      0,
      normalizeOrderLine(
        {
          ...source,
          quantity: 1,
        },
        form
      )
    );
    lines.value = nextLines;
  };

  const removeLine = (index) => {
    if (lines.value.length <= 1) {
      lines.value = [createEmptyOrderLine()];
      return;
    }
    lines.value = lines.value.filter((_, lineIndex) => lineIndex !== index);
  };

  const getSubmitData = () => {
    const fileIds = uploadedFiles.value.filter((f) => !f.isLocal && f.id).map((f) => f.id);

    const normalizedLines = lines.value
      .map((line) => normalizeOrderLine(line, form))
      .filter((line) => isMeaningfulLine(line));

    const payloadLines = normalizedLines.map((line) => ({
      name: line.name,
      brand: line.brand,
      series: line.series,
      sku: line.sku,
      size: line.size,
      color: line.color,
      material: line.material,
      quantity: line.quantity,
      productId: line.productId,
      variantId: line.variantId,
    }));

    const rolledUpQuantity =
      payloadLines.length > 0
        ? payloadLines.reduce((sum, line) => sum + normalizeLineQuantity(line.quantity), 0)
        : normalizeLineQuantity(form.quantity);

    const primaryLine = payloadLines[0] || null;
    const payload = {
      ...form,
      fileIds,
      quantity: rolledUpQuantity,
    };

    if (primaryLine) {
      payload.name = primaryLine.name;
      payload.brand = primaryLine.brand;
      payload.series = primaryLine.series;
      payload.sku = primaryLine.sku;
      payload.size = primaryLine.size;
      payload.color = primaryLine.color;
      payload.material = primaryLine.material;
      payload.productId = payloadLines.length === 1 ? primaryLine.productId : null;
      payload.variantId = payloadLines.length === 1 ? primaryLine.variantId : null;
      payload.lines = payloadLines;
    }

    return payload;
  };

  const saveHistory = () => {
    saveMultiple({
      name: lines.value[0]?.name || form.name,
      brand: lines.value[0]?.brand || form.brand,
      series: lines.value[0]?.series || form.series,
      color: lines.value[0]?.color || form.color,
      material: lines.value[0]?.material || form.material,
      quantity: lines.value[0]?.quantity || form.quantity,
    });
  };

  const setSubmitting = (value) => {
    isSubmitting.value = value;
  };

  return {
    form,
    uploadedFiles,
    isSubmitting,
    lines,

    minDate,
    isValid,
    progressText,
    uploadEndpoint,
    nameSuggestions,
    brandSuggestions,
    seriesSuggestions,
    colorSuggestions,
    materialSuggestions,
    summaryMetrics,
    lineStates: normalizedLineStates,

    fillForm,
    getSubmitData,
    saveHistory,
    setSubmitting,
    setLines,
    updateLine,
    addLineAfter,
    copyLine,
    removeLine,
  };
}
