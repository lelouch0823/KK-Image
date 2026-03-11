<template>
  <Modal
    :model-value="modelValue"
    :title="t('product.exportModal.title', '导出商品变体')"
    size="3xl"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-5">
      <section class="space-y-2">
        <h4 class="text-sm font-semibold text-(--text-main)">{{ t('product.exportModal.format', '导出格式') }}</h4>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            class="cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors"
            :class="form.format === 'excel' ? 'border-primary bg-primary/5' : 'border-(--border-color) hover:bg-(--bg-hover)'"
            :disabled="isGenerating"
            @click="form.format = 'excel'"
          >
            <div class="flex items-center gap-2">
              <AppIcon name="chart-bar" class="size-4" />
              <span class="font-medium">Excel</span>
            </div>
            <p class="mt-1 text-xs text-(--text-secondary)">
              {{ t('product.exportModal.excel_desc', '高级报表样式（分组表头、筛选、冻结、数值格式）') }}
            </p>
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors"
            :class="form.format === 'csv' ? 'border-primary bg-primary/5' : 'border-(--border-color) hover:bg-(--bg-hover)'"
            :disabled="isGenerating"
            @click="form.format = 'csv'"
          >
            <div class="flex items-center gap-2">
              <AppIcon name="document-text" class="size-4" />
              <span class="font-medium">CSV</span>
            </div>
            <p class="mt-1 text-xs text-(--text-secondary)">
              {{ t('product.exportModal.csv_desc', '兼容性最佳，适合超大数据量') }}
            </p>
          </button>
        </div>
      </section>

      <section class="space-y-2">
        <h4 class="text-sm font-semibold text-(--text-main)">{{ t('product.exportModal.scope', '导出范围') }}</h4>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="cursor-pointer rounded-xl border border-(--border-color) px-4 py-3 hover:bg-(--bg-hover)">
            <input v-model="form.scope" type="radio" class="mr-2" value="all" :disabled="isGenerating" />
            {{ t('product.exportModal.scope_all', '全部商品') }}
          </label>
          <label class="cursor-pointer rounded-xl border border-(--border-color) px-4 py-3 hover:bg-(--bg-hover)">
            <input v-model="form.scope" type="radio" class="mr-2" value="filtered" :disabled="isGenerating" />
            {{ t('product.exportModal.scope_filtered', '当前筛选结果') }}
          </label>
        </div>
      </section>

      <section class="rounded-xl border border-(--border-color) bg-(--bg-muted) p-4">
        <div class="mb-2 flex items-center justify-between">
          <p class="text-sm font-medium text-(--text-main)">{{ t('product.exportModal.progress', '文件生成进度') }}</p>
          <span class="text-xs text-(--text-secondary)">{{ progress }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-(--bg-muted)">
          <div class="bg-primary h-full transition-all duration-300" :style="{ width: `${progress}%` }"></div>
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
      <button type="button" class="btn btn-ghost" :disabled="isGenerating" @click="$emit('update:modelValue', false)">
        {{ t('common.cancel', '取消') }}
      </button>
      <button v-if="!readyToDownload" type="button" class="btn btn-primary" :disabled="isGenerating" @click="handleGenerate">
        <AppIcon v-if="isGenerating" name="spinner" class="mr-2 size-4 animate-spin" />
        {{ isGenerating ? t('product.exportModal.generating', '生成中...') : t('product.exportModal.generate', '生成文件') }}
      </button>
      <button v-else type="button" class="btn btn-primary" @click="downloadFile">
        <AppIcon name="arrow-down-tray" class="mr-2 size-4" />
        {{ t('product.exportModal.download', '下载文件') }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import XLSX from 'xlsx-js-style';
import Modal from '@/components/ui/Modal.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useProducts } from '@/composables/useProducts';
import { buildCsvContent, buildExcelWorkbook, EXPORT_COLUMNS, flattenProductsToVariantRows } from './export/export-utils.js';

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

const resetState = () => {
  isGenerating.value = false;
  readyToDownload.value = false;
  progress.value = 0;
  currentStep.value = -1;
  statusText.value = '';
  generatedBlob.value = null;
  generatedFileName.value = '';
};

watch(() => props.modelValue, (visible) => {
  if (!visible) resetState();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stepClass = (index) => {
  if (currentStep.value > index) return 'text-success';
  if (currentStep.value === index) return 'text-primary';
  return '';
};

const fetchAllProducts = async () => {
  const filterParams = form.scope === 'filtered'
    ? { search: props.filters?.search || '', status: props.filters?.status || '' }
    : { search: '', status: '' };

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

const hydrateProducts = async (products) => {
  const result = [];
  const total = products.length || 1;
  for (let i = 0; i < products.length; i += 1) {
    const base = products[i];
    const detail = await loadProduct(base.id);
    result.push(detail || base);
    progress.value = 15 + Math.round(((i + 1) / total) * 55);
    statusText.value = t('product.exportModal.loading_rows', { current: i + 1, total });
  }
  return result;
};

const createBlobFromRows = async (rows) => {
  const date = new Date().toISOString().slice(0, 10);
  if (form.format === 'csv') {
    const csv = buildCsvContent(rows, EXPORT_COLUMNS);
    generatedFileName.value = `products_variants_${date}.csv`;
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }
  const wb = buildExcelWorkbook(rows, EXPORT_COLUMNS, {
    generatedAt: new Date().toISOString(),
    scopeLabel: form.scope === 'filtered'
      ? t('product.exportModal.scope_filtered', '当前筛选结果')
      : t('product.exportModal.scope_all', '全部商品'),
    filtersLabel: form.scope === 'filtered'
      ? `search=${props.filters?.search || '-'}, status=${props.filters?.status || '-'}`
      : '-',
  });
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  generatedFileName.value = `products_variants_${date}.xlsx`;
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

const handleGenerate = async () => {
  if (isGenerating.value) return;
  isGenerating.value = true;
  readyToDownload.value = false;
  generatedBlob.value = null;

  try {
    currentStep.value = 0;
    progress.value = 5;
    statusText.value = t('product.exportModal.step_prepare_detail', '正在拉取商品数据...');
    await sleep(120);
    const products = await fetchAllProducts();

    currentStep.value = 1;
    statusText.value = t('product.exportModal.step_build_detail', '正在加载变体详情...');
    const detailProducts = await hydrateProducts(products);
    const rows = flattenProductsToVariantRows(detailProducts);

    statusText.value = t('product.exportModal.step_render_detail', '正在生成文件...');
    progress.value = 85;
    await sleep(120);
    generatedBlob.value = await createBlobFromRows(rows);

    currentStep.value = 2;
    progress.value = 100;
    statusText.value = t('product.exportModal.ready_desc', { count: rows.length });
    readyToDownload.value = true;
  } catch (error) {
    statusText.value = error.message || t('common.error', '生成失败');
    addToast({ type: 'error', message: statusText.value });
  } finally {
    isGenerating.value = false;
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
