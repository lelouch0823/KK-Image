<template>
  <Modal
    :model-value="modelValue"
    :title="t('product.exportModal.title', '导出商品变体')"
    size="3xl"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-5">
      <section class="space-y-2">
        <h4 class="text-sm font-semibold text-(--text-main)">
          {{ t('product.exportModal.format', '导出格式') }}
        </h4>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AppCard
            clickable
            :selected="form.format === 'excel'"
            padding="p-4"
            class="text-left"
            :class="{ 'pointer-events-none opacity-60': isGenerating }"
            data-testid="export-format-excel"
            @click="!isGenerating && (form.format = 'excel')"
          >
            <div class="flex items-center gap-2">
              <AppIcon name="chart-bar" class="size-4" />
              <span class="font-medium">Excel</span>
            </div>
            <p class="mt-1 text-xs text-(--text-secondary)">
              {{
                t(
                  'product.exportModal.excel_desc',
                  '高级报表样式（分组表头、筛选、冻结、数值格式）'
                )
              }}
            </p>
          </AppCard>
          <AppCard
            clickable
            :selected="form.format === 'csv'"
            padding="p-4"
            class="text-left"
            :class="{ 'pointer-events-none opacity-60': isGenerating }"
            data-testid="export-format-csv"
            @click="!isGenerating && (form.format = 'csv')"
          >
            <div class="flex items-center gap-2">
              <AppIcon name="document-text" class="size-4" />
              <span class="font-medium">CSV</span>
            </div>
            <p class="mt-1 text-xs text-(--text-secondary)">
              {{ t('product.exportModal.csv_desc', '兼容性最佳，适合超大数据量') }}
            </p>
          </AppCard>
        </div>
      </section>

      <section class="space-y-2">
        <h4 class="text-sm font-semibold text-(--text-main)">
          {{ t('product.exportModal.scope', '导出范围') }}
        </h4>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AppCard
            clickable
            :selected="form.scope === 'all'"
            padding="p-4"
            class="text-left"
            :class="{ 'pointer-events-none opacity-60': isGenerating }"
            data-testid="export-scope-all"
            @click="!isGenerating && (form.scope = 'all')"
          >
            {{ t('product.exportModal.scope_all', '全部商品') }}
          </AppCard>
          <AppCard
            clickable
            :selected="form.scope === 'filtered'"
            padding="p-4"
            class="text-left"
            :class="{ 'pointer-events-none opacity-60': isGenerating }"
            data-testid="export-scope-filtered"
            @click="!isGenerating && (form.scope = 'filtered')"
          >
            {{ t('product.exportModal.scope_filtered', '当前筛选结果') }}
          </AppCard>
        </div>
      </section>

      <section class="rounded-xl border border-(--border-color) bg-(--bg-muted) p-4">
        <div class="mb-2 flex items-center justify-between">
          <p class="text-sm font-medium text-(--text-main)">
            {{ t('product.exportModal.progress', '文件生成进度') }}
          </p>
          <span class="text-xs text-(--text-secondary)">{{ progress }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-(--bg-muted)">
          <div
            class="bg-primary h-full transition-all duration-300"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
        <div class="mt-3 space-y-1 text-xs text-(--text-secondary)">
          <p :class="stepClass(0)">{{ t('product.exportModal.step_prepare', '1. 准备数据') }}</p>
          <p :class="stepClass(1)">{{ t('product.exportModal.step_build', '2. 生成报表') }}</p>
          <p :class="stepClass(2)">{{ t('product.exportModal.step_ready', '3. 准备下载') }}</p>
        </div>
        <p v-if="statusText" class="mt-2 text-xs text-(--text-secondary)">{{ statusText }}</p>
      </section>
    </div>

    <template #footer>
      <AppButton
        variant="secondary"
        :disabled="isGenerating"
        @click="$emit('update:modelValue', false)"
      >
        {{ t('common.cancel', '取消') }}
      </AppButton>
      <AppButton
        v-if="!readyToDownload"
        variant="primary"
        :disabled="isGenerating"
        data-testid="export-generate"
        @click="handleGenerate"
      >
        <template #icon-left>
          <AppIcon v-if="isGenerating" name="spinner" class="size-4 animate-spin" />
        </template>
        {{
          isGenerating
            ? t('product.exportModal.generating', '生成中...')
            : t('product.exportModal.generate', '生成文件')
        }}
      </AppButton>
      <AppButton v-else variant="primary" data-testid="export-download" @click="downloadFile">
        <template #icon-left>
          <AppIcon name="arrow-down-tray" class="size-4" />
        </template>
        {{ t('product.exportModal.download', '下载文件') }}
      </AppButton>
    </template>
  </Modal>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import Modal from '@/components/ui/Modal.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { formatDate, toDateShort } from '@/utils/formatters';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useProducts } from '@/composables/useProducts';
import {
  buildCsvContent,
  buildExcelWorkbook,
  EXPORT_COLUMNS,
  flattenProductsToVariantRows,
  normalizeProductExportFilters,
} from './export/export-utils';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({ search: '', status: '' }) },
});

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();
const { addToast } = useToast();
const { listProductsForExport, loadProduct } = useProducts();

const form = reactive({
  format: 'excel',
  scope: 'all',
});

const isGenerating = ref(false);
const readyToDownload = ref(false);
const progress = ref(0);
const currentStep = ref(-1);
const statusText = ref('');
const generatedBlob = ref(null);
const generatedFileName = ref('');
let generationRequestId = 0;

const invalidateReadyDownload = () => {
  if (isGenerating.value) return;
  if (!readyToDownload.value && !generatedBlob.value && !generatedFileName.value) return;
  readyToDownload.value = false;
  generatedBlob.value = null;
  generatedFileName.value = '';
  progress.value = 0;
  currentStep.value = -1;
  statusText.value = '';
};

const resetState = () => {
  isGenerating.value = false;
  readyToDownload.value = false;
  progress.value = 0;
  currentStep.value = -1;
  statusText.value = '';
  generatedBlob.value = null;
  generatedFileName.value = '';
  form.format = 'excel';
  form.scope = 'all';
};

const invalidateGeneration = () => {
  generationRequestId += 1;
};

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      invalidateGeneration();
      resetState();
    }
  }
);

watch([() => form.format, () => form.scope], () => {
  invalidateReadyDownload();
});

watch(
  () => JSON.stringify(normalizeProductExportFilters(form.scope, props.filters)),
  () => {
    if (form.scope !== 'filtered') return;
    invalidateReadyDownload();
  }
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stepClass = (index) => {
  if (currentStep.value > index) return 'text-success';
  if (currentStep.value === index) return 'text-primary';
  return '';
};

const fetchAllProducts = async () => {
  const filterParams = normalizeProductExportFilters(form.scope, props.filters);

  const all = [];
  let page = 1;
  const limit = 100;
  while (true) {
    const res = await listProductsForExport({
      ...filterParams,
      page,
      limit,
    });
    if (!res?.success) {
      throw new Error(res?.error || 'Load products failed');
    }
    const items = Array.isArray(res.data) ? res.data : [];
    all.push(...items);
    if (items.length < limit) break;
    page += 1;
  }
  return all;
};

const isGenerationActive = (requestId) => requestId === generationRequestId && props.modelValue;

const hydrateProducts = async (products, requestId) => {
  const result = [];
  const total = products.length || 1;
  for (let i = 0; i < products.length; i += 1) {
    const base = products[i];
    const detail = await loadProduct(base.id);
    if (!isGenerationActive(requestId)) return null;
    if (!detail) {
      throw new Error(
        t(
          'product.exportModal.detail_load_failed',
          { name: base?.name || base?.id || '-' },
          `Failed to load full product details for export: ${base?.name || base?.id || '-'}`
        )
      );
    }
    result.push(detail);
    progress.value = 15 + Math.round(((i + 1) / total) * 55);
    statusText.value = t('product.exportModal.loading_rows', { current: i + 1, total });
  }
  return result;
};

let _xlsxStyle = null;
async function getXLSXStyle() {
  if (!_xlsxStyle) _xlsxStyle = await import('xlsx-js-style');
  return _xlsxStyle;
}

const createBlobFromRows = async (rows) => {
  const date = toDateShort();
  if (form.format === 'csv') {
    const csv = buildCsvContent(rows, EXPORT_COLUMNS);
    return {
      blob: new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      fileName: `products_variants_${date}.csv`,
    };
  }
  const wb = await buildExcelWorkbook(rows, EXPORT_COLUMNS, {
    generatedAt: formatDate(Date.now()),
    scopeLabel:
      form.scope === 'filtered'
        ? t('product.exportModal.scope_filtered', '当前筛选结果')
        : t('product.exportModal.scope_all', '全部商品'),
    filtersLabel:
      form.scope === 'filtered'
        ? `search=${props.filters?.search || '-'}, status=${props.filters?.status || '-'}, brand=${props.filters?.brand || '-'}, category=${props.filters?.category || '-'}, hasStock=${props.filters?.hasStock || '-'}`
        : '-',
  });
  const XLSXStyle = await getXLSXStyle();
  const buffer = XLSXStyle.write(wb, { type: 'array', bookType: 'xlsx' });
  return {
    blob: new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName: `products_variants_${date}.xlsx`,
  };
};

const handleGenerate = async () => {
  if (isGenerating.value) return;
  const requestId = ++generationRequestId;
  isGenerating.value = true;
  readyToDownload.value = false;
  generatedBlob.value = null;

  try {
    currentStep.value = 0;
    progress.value = 5;
    statusText.value = t('product.exportModal.step_prepare_detail', '正在拉取商品数据...');
    await sleep(120);
    if (!isGenerationActive(requestId)) return;
    const products = await fetchAllProducts();
    if (!isGenerationActive(requestId)) return;

    currentStep.value = 1;
    statusText.value = t('product.exportModal.step_build_detail', '正在加载变体详情...');
    const detailProducts = await hydrateProducts(products, requestId);
    if (!isGenerationActive(requestId) || !detailProducts) return;
    const rows = flattenProductsToVariantRows(
      detailProducts,
      normalizeProductExportFilters(form.scope, props.filters)
    );

    statusText.value = t('product.exportModal.step_render_detail', '正在生成文件...');
    progress.value = 85;
    await sleep(120);
    if (!isGenerationActive(requestId)) return;
    const generatedFile = await createBlobFromRows(rows);
    if (!isGenerationActive(requestId)) return;
    generatedBlob.value = generatedFile.blob;
    generatedFileName.value = generatedFile.fileName;

    currentStep.value = 2;
    progress.value = 100;
    statusText.value = t('product.exportModal.ready_desc', { count: rows.length });
    readyToDownload.value = true;
  } catch (error) {
    if (!isGenerationActive(requestId)) return;
    statusText.value = error.message || t('common.error', '生成失败');
    addToast({ type: 'error', message: statusText.value });
  } finally {
    if (requestId === generationRequestId) {
      isGenerating.value = false;
    }
  }
};

const downloadFile = () => {
  if (!generatedBlob.value) return;
  const url = window.URL.createObjectURL(generatedBlob.value);
  const link = document.createElement('a');
  link.href = url;
  link.download = generatedFileName.value || 'products_export.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  addToast({ type: 'success', message: t('common.success', '成功') });
  emit('update:modelValue', false);
};
</script>
