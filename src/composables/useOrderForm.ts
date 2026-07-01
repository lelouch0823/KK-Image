/**
 * 订单表单 Composable
 * 提供订单表单的状态管理、验证和提交逻辑
 *
 * @file src/composables/useOrderForm.ts
 */

import { ref, reactive, computed, type Ref, type ComputedRef } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useRecentInputs } from '@/composables/useRecentInputs';
import { useSalesToken } from '@/composables/useSalesToken';
import { getTodayISOString } from '@/utils/common';
import { API } from '@/utils/constants';

let orderLineClientIdSeed = 0;

function createOrderLineClientId(): string {
  orderLineClientIdSeed += 1;
  return `order-line-${orderLineClientIdSeed}`;
}

function normalizeLineText(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function normalizeLineQuantity(value: unknown, fallback = 1): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.trunc(parsed);
}

interface OrderLine {
  clientId: string;
  name: string;
  brand: string;
  series: string;
  sku: string;
  size: string;
  color: string;
  material: string;
  quantity: number;
  productId: string | null;
  variantId: string | null;
  boundProduct: unknown;
  boundProductVariant: unknown;
  [key: string]: unknown;
}

interface OrderLineOverrides extends Partial<OrderLine> {
  clientId?: string;
}

interface OrderFormData {
  name: string;
  brand: string;
  series: string;
  sku: string;
  color: string;
  material: string;
  size: string;
  quantity: number;
  remark: string;
  deadline: string;
  [key: string]: unknown;
}

interface UploadedFile {
  id?: string;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  isLocal: boolean;
}

interface LineCompletionState {
  status: 'empty' | 'ready' | 'pending';
  tone: 'neutral' | 'success' | 'info' | 'warning';
  label: string;
  message?: string;
  isMeaningful: boolean;
  isSubmittable: boolean;
}

interface NormalizedLineState {
  line: OrderLine;
  completion: LineCompletionState;
}

interface SummaryMetrics {
  lineCount: number;
  meaningfulLineCount: number;
  validLineCount: number;
  pendingLineCount: number;
  totalQuantity: number;
  imageCount: number;
}

interface SubmitProgress {
  step?: string;
  current?: number;
  total?: number;
}

interface OrderFormOptions {
  isSalesMode?: boolean;
  submitProgress?: Ref<SubmitProgress | undefined>;
}

export function createEmptyOrderLine(overrides: OrderLineOverrides = {}): OrderLine {
  const { clientId, ...restOverrides } = overrides;
  return {
    clientId: clientId ?? createOrderLineClientId(),
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
    ...restOverrides,
  } as OrderLine;
}

function normalizeOrderLine(line: Record<string, unknown> = {}, fallback: Record<string, unknown> = {}): OrderLine {
  return createEmptyOrderLine({
    clientId: (line.clientId as string) ?? (fallback.clientId as string),
    name: normalizeLineText(line.name ?? line.productName, (fallback.name as string) || ''),
    brand: normalizeLineText(line.brand, (fallback.brand as string) || ''),
    series: normalizeLineText(line.series, (fallback.series as string) || ''),
    sku: normalizeLineText(line.sku, (fallback.sku as string) || ''),
    size: normalizeLineText(line.size, (fallback.size as string) || ''),
    color: normalizeLineText(line.color, (fallback.color as string) || ''),
    material: normalizeLineText(line.material, (fallback.material as string) || ''),
    quantity: normalizeLineQuantity(line.quantity ?? line.orderedQuantity, (fallback.quantity as number) || 1),
    productId: (line.productId as string) ?? (fallback.productId as string) ?? null,
    variantId: (line.variantId as string) ?? (fallback.variantId as string) ?? null,
    boundProduct: line.boundProduct ?? fallback.boundProduct ?? null,
    boundProductVariant: line.boundProductVariant ?? fallback.boundProductVariant ?? null,
  });
}

function isMeaningfulLine(line: OrderLine = createEmptyOrderLine()): boolean {
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

function getLineCompletionState(line: OrderLine = createEmptyOrderLine(), t: (key: string, fallback?: string) => string = (_key, fallback) => fallback ?? ''): LineCompletionState {
  if (!isMeaningfulLine(line)) {
    return {
      status: 'empty',
      tone: 'neutral',
      label: t('order.form.blankLine', '空白行'),
      isMeaningful: false,
      isSubmittable: false,
    };
  }

  if (normalizeLineText(line.name)) {
    return {
      status: 'ready',
      tone: line.productId || line.variantId ? 'success' : 'info',
      label: line.productId || line.variantId ? t('order.form.bound', '已绑定') : t('order.form.manualEntry', '手工填写'),
      isMeaningful: true,
      isSubmittable: true,
    };
  }

  return {
    status: 'pending',
    tone: 'warning',
    label: t('order.form.pending', '待完善'),
    message: t('order.form.pendingMessage', '请填写商品名称或绑定商品'),
    isMeaningful: true,
    isSubmittable: false,
  };
}

export function useOrderForm(options: OrderFormOptions = {}) {
  const { t } = useI18n();

  const form: OrderFormData = reactive({
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

  const uploadedFiles: Ref<UploadedFile[]> = ref([]);
  const isSubmitting: Ref<boolean> = ref(false);
  const lines: Ref<OrderLine[]> = ref([createEmptyOrderLine()]);

  const minDate: ComputedRef<string> = computed(() => getTodayISOString());

  const { getRecent, saveMultiple } = useRecentInputs('order');
  const nameSuggestions: ComputedRef<string[]> = computed(() => getRecent('name'));
  const brandSuggestions: ComputedRef<string[]> = computed(() => getRecent('brand'));
  const seriesSuggestions: ComputedRef<string[]> = computed(() => getRecent('series'));
  const colorSuggestions: ComputedRef<string[]> = computed(() => getRecent('color'));
  const materialSuggestions: ComputedRef<string[]> = computed(() => getRecent('material'));

  const { token: salesToken } = useSalesToken();
  const uploadEndpoint: ComputedRef<string> = computed(() => {
    const isSales = options.isSalesMode !== false;
    if (!isSales) {
      return API.MANAGE_UPLOAD;
    }
    return API.SALES_UPLOAD(salesToken.value || '');
  });

  const normalizedLineStates: ComputedRef<NormalizedLineState[]> = computed(() =>
    lines.value.map((line) => {
      const normalized = normalizeOrderLine(line, form);
      return {
        line: normalized,
        completion: getLineCompletionState(normalized, t),
      };
    })
  );

  const summaryMetrics: ComputedRef<SummaryMetrics> = computed(() => {
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

  const isValid: ComputedRef<boolean> = computed(
    () =>
      summaryMetrics.value.validLineCount > 0 &&
      summaryMetrics.value.pendingLineCount === 0 &&
      uploadedFiles.value.length > 0
  );

  const progressText: ComputedRef<string> = computed(() => {
    const { step, current, total } = options.submitProgress?.value || {};
    if (step === 'creating') return t('order.form.stepCreating');
    if (step === 'uploading') return t('order.form.stepUploading', { current, total });
    if (step === 'linking') return t('order.form.stepLinking');
    if (isSubmitting.value) return t('order.form.submitting');
    return t('order.form.submit');
  });

  const resetFormState = (): void => {
    Object.keys(form).forEach((key) => {
      form[key] = key === 'quantity' ? 1 : '';
    });
    uploadedFiles.value = [];
    lines.value = [createEmptyOrderLine()];
  };

  const fillForm = (data: Record<string, unknown> | null | undefined): void => {
    resetFormState();

    if (!data) {
      return;
    }

    Object.keys(form).forEach((key) => {
      if (data[key] !== undefined) {
        form[key] = data[key] as never;
      }
    });

    const rawLines = Array.isArray(data.lines) ? (data.lines as Record<string, unknown>[]).filter(Boolean) : [];
    if (rawLines.length > 0) {
      lines.value = rawLines.map((line) => normalizeOrderLine(line, data));
    }

    if (data.files && Array.isArray(data.files) && data.files.length > 0) {
      uploadedFiles.value = (data.files as Record<string, unknown>[]).map((f) => ({
        id: f.id as string,
        name: f.name as string,
        url: f.url as string,
        mimeType: f.mimeType as string,
        size: f.size as number,
        isLocal: false,
      }));
    }
  };

  const setLines = (nextLines: Record<string, unknown>[] = []): void => {
    if (!Array.isArray(nextLines) || nextLines.length === 0) {
      lines.value = [createEmptyOrderLine()];
      return;
    }
    lines.value = nextLines.map((line) => normalizeOrderLine(line, form));
  };

  const updateLine = (index: number, nextLine: Record<string, unknown>): void => {
    lines.value = lines.value.map((line, lineIndex) =>
      lineIndex === index
        ? normalizeOrderLine(nextLine, {
            ...form,
            ...line,
            clientId: line.clientId,
          })
        : line
    );
  };

  const addLineAfter = (index: number): void => {
    const targetIndex = Number.isInteger(index) ? index : lines.value.length - 1;
    const nextLines = [...lines.value];
    nextLines.splice(targetIndex + 1, 0, createEmptyOrderLine());
    lines.value = nextLines;
  };

  const copyLine = (index: number): void => {
    const source = normalizeOrderLine(lines.value[index], form);
    const nextLines = [...lines.value];
    nextLines.splice(
      index + 1,
      0,
      normalizeOrderLine(
        {
          ...source,
          clientId: createOrderLineClientId(),
          quantity: 1,
        },
        form
      )
    );
    lines.value = nextLines;
  };

  const removeLine = (index: number): void => {
    if (lines.value.length <= 1) {
      lines.value = [createEmptyOrderLine()];
      return;
    }
    lines.value = lines.value.filter((_, lineIndex) => lineIndex !== index);
  };

  const getSubmitData = (): Record<string, unknown> => {
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
    const payload: Record<string, unknown> = {
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

  const saveHistory = (): void => {
    saveMultiple({
      name: lines.value[0]?.name || form.name,
      brand: lines.value[0]?.brand || form.brand,
      series: lines.value[0]?.series || form.series,
      color: lines.value[0]?.color || form.color,
      material: lines.value[0]?.material || form.material,
      quantity: String(lines.value[0]?.quantity || form.quantity),
    });
  };

  const setSubmitting = (value: boolean): void => {
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
