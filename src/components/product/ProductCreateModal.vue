<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-(--color-overlay-dim) backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        @click="$emit('update:modelValue', false)"
      ></div>

      <!-- Modal Container -->
      <div class="flex min-h-screen items-center justify-center p-4">
        <!-- Modal Panel -->
        <div
          class="relative w-full max-w-4xl transform overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) text-left shadow-2xl transition-all"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between border-b border-(--border-color) bg-(--bg-muted)/50 px-6 py-4"
          >
            <h3 class="font-[Outfit] text-lg leading-6 font-bold text-(--text-main)">
              {{ editMode ? t('product.modal.edit_title') : t('product.modal.create_title') }}
            </h3>
            <button
              class="text-(--text-muted) transition-colors hover:text-(--text-secondary) focus:outline-none"
              @click="$emit('update:modelValue', false)"
            >
              <span class="sr-only">{{ t('common.close') }}</span>
              <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="custom-scrollbar max-h-[70vh] overflow-y-auto p-6">
            <form id="product-form" class="space-y-8" @submit.prevent="handleSubmit">
              <div class="space-y-6">
                <!-- Basic Info -->
                <div class="space-y-4">
                  <AppInput
                    v-model="form.name"
                    :label="t('product.form.name')"
                    :placeholder="t('product.form.name_placeholder')"
                    required
                  />

                  <AppInput
                    v-model="form.description"
                    :label="t('product.form.description')"
                    :placeholder="t('product.form.description_placeholder')"
                    textarea
                    :rows="3"
                  />
                </div>

                <!-- Group 2: Brand & Series (2 cols) & Category, SPU, Slug (3 cols) -->
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <AppInput
                    v-model="form.brand"
                    :label="t('order.form.brand')"
                    :placeholder="t('order.form.brandPlaceholder')"
                  />
                  <AppInput
                    v-model="form.series"
                    :label="t('order.form.series')"
                    :placeholder="t('order.form.seriesPlaceholder')"
                  />
                  <!-- 货币选择器 -->
                  <div>
                    <label class="mb-1.5 block text-sm font-medium text-(--text-main)">{{ t('product.form.currency', 'Currency') }}</label>
                    <select
                      v-model="form.currency"
                      class="w-full rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-2 text-sm text-(--text-main) transition-colors focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option v-for="c in CURRENCY_OPTIONS" :key="c.code" :value="c.code">
                        {{ c.symbol }} {{ c.code }} — {{ c.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <AppInput
                    v-model="form.category"
                    :label="t('product.form.category')"
                    :placeholder="t('product.form.category_placeholder')"
                  />
                  <AppInput
                    v-model="form.spu"
                    :label="t('product.form.spu')"
                    placeholder="e.g. SPU-0001"
                    class="font-mono uppercase"
                  />
                  <AppInput
                    v-model="form.slug"
                    :label="t('product.form.slug_seo')"
                    :placeholder="t('product.form.slug_placeholder')"
                  />
                </div>

                <!-- Options Builder -->
                <div
                  class="space-y-4 rounded-2xl border border-[var(--border-color)] bg-gradient-to-br from-[var(--bg-muted)] to-[var(--bg-card)] p-4"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <h4 class="font-bold text-[var(--text-main)]">
                        {{ t('product.form.options_title', 'Product Options') }}
                      </h4>
                      <p class="text-xs text-[var(--text-secondary)]">
                        {{ t('product.form.options_hint', '最多 3 个维度，支持归档与恢复') }}
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="cursor-pointer rounded-lg border border-[var(--border-color)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-page)]"
                        @click="showVariantBatchBuilder = true"
                      >
                        {{ t('product.form.batch_build_variants', 'Batch Build') }}
                      </button>
                      <button
                        type="button"
                        class="flex cursor-pointer items-center gap-1 rounded-lg bg-[var(--color-primary)]/10 px-2 py-1 text-sm font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20 hover:text-[var(--color-primary-hover)]"
                        @click="addOption"
                      >
                        <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        {{ t('product.form.add_option', 'Add Option') }}
                      </button>
                    </div>
                  </div>
                  <div class="space-y-4">
                    <div
                      v-for="(opt, idx) in form.options"
                      :key="idx"
                      class="relative rounded-xl border border-[var(--border-color)]/70 bg-[var(--bg-card)] p-3 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <button
                        type="button"
                        class="absolute top-2 right-2 cursor-pointer text-[var(--text-muted)] transition-colors hover:text-[var(--color-danger)]"
                        @click="removeOption(idx)"
                      >
                        <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                      <div class="mb-2 flex items-center gap-2">
                        <span
                          class="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]"
                          >{{ t('product.form.dimension_label', '维度') }} {{ idx + 1 }}</span
                        >
                        <span
                          class="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]"
                          >{{ opt.values.length }} {{ t('product.form.values_count', '值') }}</span
                        >
                      </div>
                      <div class="mb-2 w-2/3 pr-6">
                        <AppInput
                          v-model="opt.name"
                          :placeholder="t('product.form.option_name', 'Option Name (e.g., Color)')"
                          size="sm"
                          @input="generateVariants"
                        />
                      </div>
                      <div>
                        <AppInput
                          v-model="opt.inputValue"
                          :placeholder="
                            t('product.form.option_values', 'Enter values separated by comma')
                          "
                          size="sm"
                          @keydown.enter.prevent="addOptionValue(opt)"
                          @blur="addOptionValue(opt)"
                        />
                        <div class="mt-2 flex flex-wrap gap-2">
                          <span
                            v-for="(val, vIdx) in opt.values"
                            :key="vIdx"
                            class="inline-flex items-center gap-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-main)]"
                          >
                            {{ val }}
                            <button
                              type="button"
                              class="text-[var(--text-muted)] hover:text-[var(--color-danger)]"
                              @click="removeOptionValue(opt, vIdx)"
                            >
                              &times;
                            </button>
                          </span>
                        </div>
                        <div
                          v-if="Array.isArray(opt.archivedValues) && opt.archivedValues.length > 0"
                          class="mt-2 flex flex-wrap items-center gap-2"
                        >
                          <span class="text-[10px] text-[var(--text-secondary)]"
                            >{{ t('product.form.archived_values', 'Archived') }}:</span
                          >
                          <span
                            v-for="(archived, aIdx) in opt.archivedValues"
                            :key="`${archived.id || archived.value}-${aIdx}`"
                            class="inline-flex items-center gap-1 rounded-full border border-[var(--border-color)]/60 bg-[var(--bg-page)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                          >
                            {{ archived.value }}
                            <button
                              type="button"
                              :data-testid="`restore-value-${idx}-${aIdx}`"
                              class="text-[var(--color-primary)]"
                              @click="restoreOptionValue(opt, archived, aIdx)"
                            >
                              {{ t('common.restore', 'Restore') }}
                            </button>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Variants Matrix -->
                <div
                  v-if="form.variants.length > 0"
                  class="space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]/50 p-4"
                >
                  <div class="flex items-center justify-between">
                    <h4 class="font-bold text-[var(--text-main)]">
                      {{ t('product.form.variants_title', 'Variants') }}
                    </h4>
                    <button
                      type="button"
                      class="text-sm font-medium text-[var(--color-primary)]"
                      @click="showVariantImageManager = true"
                    >
                      {{ t('product.form.manage_variant_images', 'Manage Variant Images') }}
                    </button>
                  </div>
                  <ProductVariantTable
                    v-model="form.variants"
                    :currency-symbol="CURRENCY_SYMBOLS[form.currency] || '¥'"
                  />
                </div>

                <!-- Images -->
                <div>
                  <ImageUploader
                    v-model="imageObjects"
                    :label="t('product.form.media')"
                    :hint="t('product.form.media_help')"
                    :upload-endpoint="API.MANAGE_UPLOAD"
                    :max-files="10"
                    context="product"
                  />
                </div>
              </div>
            </form>
          </div>

          <!-- Footer -->
          <div
            class="flex justify-end gap-3 border-t border-(--border-color) bg-(--bg-muted) px-6 py-4"
          >
            <AppButton
              variant="secondary"
              :text="t('product.action.cancel')"
              @click="$emit('update:modelValue', false)"
            />
            <AppButton
              variant="primary"
              :text="
                submitting
                  ? t('common.saving')
                  : editMode
                    ? t('product.action.save')
                    : t('product.action.create')
              "
              :loading="submitting"
              @click="handleSubmit"
            />
          </div>
        </div>
      </div>
    </div>
    <VariantImageManagerModal
      v-model="showVariantImageManager"
      :variants="form.variants"
      @update-images="handleUpdateVariantImages"
    />
    <VariantBatchBuilderModal
      v-model="showVariantBatchBuilder"
      :existing-variants="form.variants"
      @apply="handleBatchBuilderApply"
    />
    <Modal
      :model-value="dimensionArchiveWizard.open"
      size="lg"
      :closable="!dimensionArchiveWizard.loading"
      @update:model-value="
        (value) => {
          if (!value) closeDimensionArchiveWizard();
        }
      "
    >
      <div data-testid="dimension-archive-modal" class="relative">
        <h4 class="text-lg font-bold text-[var(--text-main)]">
          {{ t('product.form.archive_dimension_title', 'Archive Dimension') }}
        </h4>
        <p class="mt-2 text-xs text-[var(--text-secondary)]">
          {{ t('product.form.step_label', 'Step') }} {{ dimensionArchiveWizard.step }} / 2
        </p>
        <div v-if="dimensionArchiveWizard.step === 1">
          <p class="mt-2 text-sm text-[var(--text-secondary)]">
            {{ t('product.form.archive_dimension_impact', 'This action will affect variants:') }}
            <span class="font-semibold text-[var(--text-main)]">{{
              dimensionArchiveWizard.affectedVariantsCount
            }}</span>
          </p>
          <p class="mt-1 text-xs text-[var(--text-secondary)]">
            {{
              t(
                'product.form.archive_dimension_hint',
                'Preview impact first, then choose action strategy.'
              )
            }}
          </p>
          <div
            v-if="dimensionArchiveWizard.sampleVariants.length > 0"
            class="mt-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-page)] p-2"
          >
            <p class="mb-1 text-[10px] font-semibold text-[var(--text-secondary)]">
              {{ t('product.form.sample_variants', 'Sample variants') }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="sample in dimensionArchiveWizard.sampleVariants"
                :key="sample.id"
                class="inline-flex items-center rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[11px] text-[var(--text-main)]"
              >
                {{ formatVariantSample(sample) }}
              </span>
            </div>
          </div>
        </div>

        <div v-else class="mt-4 space-y-2">
          <label
            class="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border-color)] p-3"
          >
            <input
              v-model="dimensionArchiveWizard.mode"
              data-testid="dimension-archive-mode-archive"
              type="radio"
              value="archive_variants"
              class="mt-0.5"
            />
            <div>
              <p class="text-sm font-medium text-[var(--text-main)]">
                {{ t('product.form.archive_affected_variants', 'Archive affected variants') }}
              </p>
              <p class="text-xs text-[var(--text-secondary)]">
                {{
                  t('product.form.archive_affected_variants_desc', 'Safe default for edit flow.')
                }}
              </p>
            </div>
          </label>
          <label
            class="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border-color)] p-3"
          >
            <input
              v-model="dimensionArchiveWizard.mode"
              data-testid="dimension-archive-mode-merge"
              type="radio"
              value="merge_keep"
              class="mt-0.5"
            />
            <div>
              <p class="text-sm font-medium text-[var(--text-main)]">
                {{ t('product.form.merge_and_keep', 'Merge & keep') }}
              </p>
              <p class="text-xs text-[var(--text-secondary)]">
                {{
                  t(
                    'product.form.merge_and_keep_desc',
                    'Ignore removed dimension and dedupe by signature.'
                  )
                }}
              </p>
            </div>
          </label>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-main)]"
            :disabled="dimensionArchiveWizard.loading"
            @click="closeDimensionArchiveWizard"
          >
            {{ t('common.cancel', 'Cancel') }}
          </button>
          <button
            v-if="dimensionArchiveWizard.step === 2"
            type="button"
            class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-main)]"
            :disabled="dimensionArchiveWizard.loading"
            @click="dimensionArchiveWizard.step = 1"
          >
            {{ t('common.back', 'Back') }}
          </button>
          <button
            v-if="dimensionArchiveWizard.step === 1"
            data-testid="dimension-archive-next"
            type="button"
            class="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm text-white"
            :disabled="dimensionArchiveWizard.loading"
            @click="dimensionArchiveWizard.step = 2"
          >
            {{ t('common.next', 'Next') }}
          </button>
          <button
            v-else
            data-testid="dimension-archive-confirm"
            type="button"
            class="rounded-lg bg-[var(--color-danger)] px-3 py-2 text-sm text-white disabled:opacity-60"
            :disabled="dimensionArchiveWizard.loading"
            @click="confirmDimensionArchive"
          >
            {{
              dimensionArchiveWizard.loading
                ? t('common.processing', 'Processing...')
                : t('common.confirm', 'Confirm')
            }}
          </button>
        </div>
      </div>
    </Modal>
    <Modal
      :model-value="valueArchiveWizard.open"
      size="lg"
      :closable="!valueArchiveWizard.loading"
      @update:model-value="
        (value) => {
          if (!value) closeValueArchiveWizard();
        }
      "
    >
      <div data-testid="value-archive-modal" class="relative">
        <h4 class="text-lg font-bold text-[var(--text-main)]">
          {{ t('product.form.archive_value_title', 'Archive Value') }}
        </h4>
        <p class="mt-2 text-sm text-[var(--text-secondary)]">
          {{ t('product.form.archive_value_impact', 'This action will affect variants:') }}
          <span class="font-semibold text-[var(--text-main)]">{{
            valueArchiveWizard.affectedVariantsCount
          }}</span>
        </p>
        <p class="mt-1 text-xs text-[var(--text-secondary)]">
          {{
            t(
              'product.form.archive_value_hint',
              'Archived values will not be used for new combinations.'
            )
          }}
        </p>
        <div
          v-if="valueArchiveWizard.sampleVariants.length > 0"
          class="mt-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-page)] p-2"
        >
          <p class="mb-1 text-[10px] font-semibold text-[var(--text-secondary)]">
            {{ t('product.form.sample_variants', 'Sample variants') }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="sample in valueArchiveWizard.sampleVariants"
              :key="sample.id"
              class="inline-flex items-center rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[11px] text-[var(--text-main)]"
            >
              {{ formatVariantSample(sample) }}
            </span>
          </div>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-main)]"
            :disabled="valueArchiveWizard.loading"
            @click="closeValueArchiveWizard"
          >
            {{ t('common.cancel', 'Cancel') }}
          </button>
          <button
            data-testid="value-archive-confirm"
            type="button"
            class="rounded-lg bg-[var(--color-danger)] px-3 py-2 text-sm text-white disabled:opacity-60"
            :disabled="valueArchiveWizard.loading"
            @click="confirmValueArchive"
          >
            {{
              valueArchiveWizard.loading
                ? t('common.processing', 'Processing...')
                : t('common.confirm', 'Confirm')
            }}
          </button>
        </div>
      </div>
    </Modal>
  </Teleport>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import ImageUploader from '@/components/common/ImageUploader.vue';
import VariantImageManagerModal from '@/components/product/VariantImageManagerModal.vue';
import VariantBatchBuilderModal from '@/components/product/VariantBatchBuilderModal.vue';
import ProductVariantTable from '@/components/product/ProductVariantTable.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';
import Modal from '@/components/ui/Modal.vue';
import { API } from '@/utils/constants';
import { buildVariantSku } from './variant-sku.js';

const { t } = useI18n();
const { addToast } = useToast();
const props = defineProps({
  modelValue: Boolean,
  editMode: Boolean,
  initialData: {
    type: Object,
    default: () => ({}),
  },
});
const emit = defineEmits(['update:modelValue', 'success']);

const {
  createProduct,
  updateProduct,
  archiveDimension,
  previewDimensionImpact,
  addDimensionValue,
  archiveDimensionValue,
  restoreDimensionValue,
} = useProducts();
const submitting = ref(false);
const showVariantImageManager = ref(false);
const showVariantBatchBuilder = ref(false);
const dimensionArchiveWizard = reactive({
  open: false,
  step: 1,
  optionIndex: -1,
  optionId: '',
  affectedVariantsCount: 0,
  sampleVariants: [],
  mode: 'archive_variants',
  loading: false,
});
const valueArchiveWizard = reactive({
  open: false,
  optionIndex: -1,
  valueIndex: -1,
  valueId: '',
  valueLabel: '',
  affectedVariantsCount: 0,
  sampleVariants: [],
  loading: false,
});

const imageObjects = ref([]);
const variantLocalKeySeed = ref(0);

// 货币配置
const CURRENCY_OPTIONS = [
  { code: 'CNY', symbol: '¥', label: '人民币' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: '日本円' },
];
const CURRENCY_SYMBOLS = Object.fromEntries(CURRENCY_OPTIONS.map(c => [c.code, c.symbol]));
const CURRENCY_CODE_SET = new Set(CURRENCY_OPTIONS.map(c => c.code));
const normalizeCurrencyCode = (value) => {
  const code = String(value || '').trim().toUpperCase();
  return CURRENCY_CODE_SET.has(code) ? code : 'CNY';
};

const form = reactive({
  name: '',
  description: '',
  brand: '',
  series: '',
  category: '',
  currency: 'CNY',
  spu: '',
  slug: '',
  images: [],
  options: [],
  variants: [],
});

const nextVariantLocalKey = () => {
  variantLocalKeySeed.value += 1;
  return `variant_local_${variantLocalKeySeed.value}`;
};

const ensureVariantLocalKey = (variant = {}) => ({
  ...variant,
  _clientKey: variant._clientKey || variant.id || nextVariantLocalKey(),
});

// Reset form when modal opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      if (props.editMode && props.initialData) {
        fillFormFromData(props.initialData);
      } else {
        resetForm();
      }
    }
  },
  { immediate: true }
);

function fillFormFromData(data) {
  const imgs = parseJson(data.images) || [];

  Object.assign(form, {
    name: data.name || '',
    description: data.description || '',
    brand: data.brand || '',
    series: data.series || '',
    category: data.category || '',
    currency: normalizeCurrencyCode(data.currency),
    spu: data.spu || '',
    slug: data.slug || '',
    images: imgs,
    options: buildOptionsFromDimensions(data),
    variants: (data.variants || []).map((variant) =>
      ensureVariantLocalKey({
        ...variant,
        cost_price: variant.cost_price ?? 0,
        alert_threshold: variant.alert_threshold ?? 10,
        status: variant.status || 'active',
        barcode: variant.barcode || '',
        supplier_sku: variant.supplier_sku || '',
        images: Array.isArray(variant.images) ? variant.images : [],
      })
    ),
  });

  // Populate imageObjects for Uploader
  imageObjects.value = imgs.map((id) => ({
    id: id,
    url: `/file/${id}`,
  }));
}

function resetForm() {
  Object.assign(form, {
    name: '',
    description: '',
    brand: '',
    series: '',
    category: '',
    currency: 'CNY',
    spu: '',
    slug: '',
    images: [],
    options: [],
    variants: [],
  });
  imageObjects.value = [];
  variantLocalKeySeed.value = 0;
}

function parseJson(str) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str || null;
  } catch {
    return null;
  }
}

function toOptionModel(raw = {}) {
  const values = Array.isArray(raw.values)
    ? raw.values
        .map((entry) => (typeof entry === 'string' ? entry : entry?.value))
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    : [];
  return {
    id: raw.id || null,
    name: String(raw.name || '').trim(),
    values: [...new Set(values)],
    inputValue: '',
    archivedValues: Array.isArray(raw.values)
      ? raw.values.filter(
          (entry) => entry && typeof entry === 'object' && entry.status === 'archived'
        )
      : [],
  };
}

function buildOptionsFromDimensions(data) {
  if (Array.isArray(data?.dimensions) && data.dimensions.length > 0) {
    return data.dimensions
      .map((dimension) =>
        toOptionModel({
          id: dimension.id,
          name: dimension.name,
          values: (dimension.values || []).filter((value) => value.status !== 'archived'),
        })
      )
      .filter((dimension) => dimension.name);
  }
  return (parseJson(data?.options) || []).map((option) => toOptionModel(option));
}

const addOption = () => {
  if (form.options.length >= 3) {
    addToast({ message: t('common.validation_error', '最多 3 个维度'), type: 'error' });
    return;
  }
  form.options.push({ id: null, name: '', values: [], inputValue: '', archivedValues: [] });
};

const removeOption = async (idx) => {
  const option = form.options[idx];
  if (!option) return;
  if (props.editMode && option.id && props.initialData?.id) {
    const impact = await previewDimensionImpact(props.initialData.id, {
      action: 'archive_dimension',
      dimensionId: option.id,
    });
    dimensionArchiveWizard.open = true;
    dimensionArchiveWizard.optionIndex = idx;
    dimensionArchiveWizard.optionId = option.id;
    dimensionArchiveWizard.affectedVariantsCount = impact?.data?.affectedVariantsCount ?? 0;
    dimensionArchiveWizard.sampleVariants = Array.isArray(impact?.data?.sampleVariants)
      ? impact.data.sampleVariants
      : [];
    dimensionArchiveWizard.mode = 'archive_variants';
    dimensionArchiveWizard.step = 1;
    return;
  }
  form.options.splice(idx, 1);
  generateVariants();
};

const closeDimensionArchiveWizard = (force = false) => {
  if (dimensionArchiveWizard.loading && !force) return;
  dimensionArchiveWizard.open = false;
  dimensionArchiveWizard.step = 1;
  dimensionArchiveWizard.optionIndex = -1;
  dimensionArchiveWizard.optionId = '';
  dimensionArchiveWizard.affectedVariantsCount = 0;
  dimensionArchiveWizard.sampleVariants = [];
  dimensionArchiveWizard.mode = 'archive_variants';
};

const confirmDimensionArchive = async () => {
  if (!props.initialData?.id || !dimensionArchiveWizard.optionId) return;
  dimensionArchiveWizard.loading = true;
  try {
    const response = await archiveDimension(props.initialData.id, dimensionArchiveWizard.optionId, {
      mode: dimensionArchiveWizard.mode,
    });
    if (!response?.success) {
      addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
      return;
    }
    if (dimensionArchiveWizard.optionIndex >= 0) {
      form.options.splice(dimensionArchiveWizard.optionIndex, 1);
      generateVariants();
    }
    closeDimensionArchiveWizard(true);
  } finally {
    dimensionArchiveWizard.loading = false;
  }
};

const closeValueArchiveWizard = (force = false) => {
  if (valueArchiveWizard.loading && !force) return;
  valueArchiveWizard.open = false;
  valueArchiveWizard.optionIndex = -1;
  valueArchiveWizard.valueIndex = -1;
  valueArchiveWizard.valueId = '';
  valueArchiveWizard.valueLabel = '';
  valueArchiveWizard.affectedVariantsCount = 0;
  valueArchiveWizard.sampleVariants = [];
};

const confirmValueArchive = async () => {
  if (!props.initialData?.id || !valueArchiveWizard.valueId) return;
  valueArchiveWizard.loading = true;
  try {
    const response = await archiveDimensionValue(props.initialData.id, valueArchiveWizard.valueId);
    if (!response?.success) {
      addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
      return;
    }
    if (valueArchiveWizard.optionIndex >= 0 && valueArchiveWizard.valueIndex >= 0) {
      const option = form.options[valueArchiveWizard.optionIndex];
      option?.values?.splice(valueArchiveWizard.valueIndex, 1);
      if (option) {
        if (!Array.isArray(option.archivedValues)) option.archivedValues = [];
        option.archivedValues.push({
          id: valueArchiveWizard.valueId,
          value: valueArchiveWizard.valueLabel,
          status: 'archived',
        });
      }
      generateVariants();
    }
    closeValueArchiveWizard(true);
  } finally {
    valueArchiveWizard.loading = false;
  }
};

const addOptionValue = async (opt) => {
  if (!opt.inputValue) return;
  const vals = opt.inputValue
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  for (const v of vals) {
    if (!opt.values.includes(v)) opt.values.push(v);
    if (props.editMode && opt.id && props.initialData?.id) {
      const response = await addDimensionValue(props.initialData.id, opt.id, { value: v });
      if (!response?.success) {
        addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
      }
    }
  }
  opt.inputValue = '';
  generateVariants();
};

const removeOptionValue = async (opt, vIdx) => {
  const value = opt.values[vIdx];
  if (props.editMode && opt.id && props.initialData?.id && value) {
    const valueMeta = (props.initialData?.dimensions || [])
      .find((dimension) => dimension.id === opt.id)
      ?.values?.find((entry) => entry.value === value);
    if (valueMeta?.id) {
      const impact = await previewDimensionImpact(props.initialData.id, {
        action: 'archive_value',
        valueId: valueMeta.id,
      });
      valueArchiveWizard.open = true;
      valueArchiveWizard.optionIndex = form.options.indexOf(opt);
      valueArchiveWizard.valueIndex = vIdx;
      valueArchiveWizard.valueId = valueMeta.id;
      valueArchiveWizard.valueLabel = value;
      valueArchiveWizard.affectedVariantsCount = impact?.data?.affectedVariantsCount ?? 0;
      valueArchiveWizard.sampleVariants = Array.isArray(impact?.data?.sampleVariants)
        ? impact.data.sampleVariants
        : [];
      return;
    }
  }
  opt.values.splice(vIdx, 1);
  generateVariants();
};

const restoreOptionValue = async (opt, archived, archivedIndex) => {
  const valueId = archived?.id;
  const value = String(archived?.value || '').trim();
  if (!value) return;

  if (props.editMode && opt.id && props.initialData?.id && valueId) {
    const response = await restoreDimensionValue(props.initialData.id, valueId);
    if (!response?.success) {
      addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
      return;
    }
  }

  if (!opt.values.includes(value)) opt.values.push(value);
  if (Array.isArray(opt.archivedValues) && archivedIndex >= 0) {
    opt.archivedValues.splice(archivedIndex, 1);
  }
  generateVariants();
};

const formatVariantSample = (sample) => {
  const raw = sample?.options_values || {};
  const optionsValues = typeof raw === 'string' ? parseJson(raw) || {} : raw;
  const parts = Object.values(optionsValues || {})
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const optionLabel = parts.length > 0 ? parts.join(' / ') : sample?.sku || sample?.id || '';
  return sample?.sku ? `${sample.sku} · ${optionLabel}` : optionLabel;
};

const generateVariants = () => {
  const validOptions = form.options.filter((o) => o.name && o.values.length > 0);
  if (validOptions.length === 0) {
    form.variants = [];
    return;
  }

  const cartesian = validOptions.reduce(
    (acc, opt) => {
      const res = [];
      acc.forEach((oldObj) => {
        opt.values.forEach((val) => {
          res.push({ ...oldObj, [opt.name]: val });
        });
      });
      return res;
    },
    [{}]
  );

  const oldVariantsMap = new Map();
  form.variants.forEach((v) => {
    const key = JSON.stringify(v.options_values);
    oldVariantsMap.set(key, v);
  });

  form.variants = cartesian.map((combo) => {
    const key = JSON.stringify(combo);
    const old = oldVariantsMap.get(key);
    if (old) return old;

    return ensureVariantLocalKey({
      sku: buildVariantSku({
        spu: form.spu,
        optionsValues: combo,
        seed: `${Date.now()}-${Math.random()}`,
      }),
      barcode: '',
      supplier_sku: '',
      price: 0,
      cost_price: 0,
      stock_quantity: 0,
      alert_threshold: 10,
      options_values: combo,
      status: 'active',
      images: [],
    });
  });
};

const handleUpdateVariantImages = ({ variantId, variantKey, images }) => {
  const key = String(variantKey || variantId || '').trim();
  const variant = form.variants.find((v) => {
    if (variantId && v.id === variantId) return true;
    return key && (v._clientKey === key || v.id === key);
  });
  if (variant) {
    variant.images = Array.isArray(images) ? images : [];
  }
};

const handleSubmit = async () => {
  if (!form.name) {
    addToast({
      message: t('common.validation_error', '请填写必填项 (商品名称)'),
      type: 'error',
    });
    return;
  }
  if (!Array.isArray(form.variants) || form.variants.length === 0) {
    addToast({
      message: t('common.validation_error', '请至少添加一个变体'),
      type: 'error',
    });
    return;
  }
  const invalidVariant = form.variants.find(
    (variant) =>
      variant.price === undefined ||
      variant.cost_price === undefined ||
      variant.stock_quantity === undefined ||
      variant.alert_threshold === undefined ||
      !variant.status
  );
  if (invalidVariant) {
    addToast({
      message: t('common.validation_error', '请完善每个变体的价格/成本/库存/预警/状态'),
      type: 'error',
    });
    return;
  }

  submitting.value = true;
  try {
    // Extract IDs from imageObjects
    const currentImageIds = imageObjects.value.map((f) => f.id).filter(Boolean);

    // Transform to snake_case for API
    const payload = {
      name: form.name,
      description: form.description,
      brand: form.brand,
      series: form.series,
      category: form.category,
      currency: normalizeCurrencyCode(form.currency),
      spu: form.spu || undefined,
      slug: form.slug || undefined,
      images: currentImageIds, // Send array of IDs
      options: form.options.map((o) => ({ name: o.name, values: o.values })),
      dimensions: form.options
        .filter((option) => option.name)
        .map((option) => ({
          id: option.id || undefined,
          name: option.name,
          values: option.values,
        })),
      variants: form.variants.map((variant) => {
        const { _clientKey, ...variantPayload } = variant;
        return {
          ...variantPayload,
          barcode: String(variant.barcode || '').trim() || null,
          supplier_sku: String(variant.supplier_sku || '').trim() || null,
        };
      }),
    };

    let success = false;

    if (props.editMode) {
      success = await updateProduct(props.initialData.id, payload);
    } else {
      success = await createProduct(payload);
    }

    if (success) {
      emit('success');
      emit('update:modelValue', false);
    }
  } finally {
    submitting.value = false;
  }
};

const variantOptionsKey = (optionsValues) =>
  JSON.stringify(
    Object.keys(optionsValues || {})
      .sort()
      .reduce((acc, key) => {
        acc[key] = optionsValues[key];
        return acc;
      }, {})
  );

const handleBatchBuilderApply = ({ options = [], variants = [] }) => {
  const normalizedOptions = options.map((option) => ({
    name: option.name,
    values: Array.isArray(option.values) ? option.values : [],
    inputValue: '',
  }));
  form.options = normalizedOptions;

  const existingMap = new Map(
    form.variants.map((variant) => [variantOptionsKey(variant.options_values), variant])
  );

  for (const variant of variants) {
    const key = variantOptionsKey(variant.options_values);
    if (existingMap.has(key)) continue;
    const optionsValues = variant.options_values || {};
    form.variants.push({
      ...ensureVariantLocalKey(variant),
      sku: buildVariantSku({ spu: form.spu, optionsValues, seed: key }),
    });
    existingMap.set(key, variant);
  }
};
</script>
