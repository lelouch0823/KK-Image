<template>
  <div v-if="embedded && modelValue" class="flex h-full flex-col">
    <div
      v-if="initializationError"
      role="alert"
      class="border-danger/20 bg-danger/5 text-danger mx-6 mt-6 rounded-xl border px-4 py-3 text-sm"
    >
      <div class="flex items-center justify-between gap-3">
        <span>{{ initializationError }}</span>
        <AppButton variant="secondary" :text="t('common.retry')" @click="$emit('retry-init')" />
      </div>
    </div>
    <div class="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
      <form id="product-form" class="space-y-8" @submit.prevent="handleSubmit">
        <div class="space-y-6">
          <ProductBasicInfoSection :form="form" :currency-options="CURRENCY_OPTIONS" />

          <ProductOptionsBuilder
            :options="form.options"
            @add-option="addOption"
            @remove-option="removeOption"
            @add-value="addOptionValue"
            @remove-value="removeOptionValue"
            @restore-value="restoreOptionValue"
            @batch-build="showVariantBatchBuilder = true"
            @generate-variants="generateVariants"
          />

          <div
            v-if="form.variants.length > 0"
            class="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-4"
          >
            <div
              v-if="editMode && incompleteVariantCount > 0"
              role="alert"
              class="border-warning/30 bg-warning-bg/80 text-warning-text flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
            >
              <svg class="mt-0.5 size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l5.58 9.92c.75 1.334-.213 2.981-1.742 2.981H4.42c-1.53 0-2.492-1.647-1.743-2.98l5.58-9.921ZM11 7a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V7Zm-1 7a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 10 14Z" clip-rule="evenodd" />
              </svg>
              <span>{{ incompleteVariantsBannerMessage }}</span>
            </div>
            <div class="flex items-center justify-between">
              <h4 class="font-bold text-(--text-main)">
                {{ t('product.form.variants_title', 'Variants') }}
              </h4>
              <button
                type="button"
                class="text-primary text-sm font-medium"
                @click="showVariantImageManager = true"
              >
                {{ t('product.form.manage_variant_images', 'Manage Variant Images') }}
              </button>
            </div>
            <ProductVariantTable
              v-model="form.variants"
              :currency-symbol="CURRENCY_SYMBOLS[form.currency] || '¥'"
              :inventory-readonly="editMode"
            />
          </div>

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
        :disabled="submitBlocked"
        @click="handleSubmit"
      />
    </div>
  </div>

  <Teleport v-else to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="fixed inset-0 bg-(--color-overlay-dim) backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        @click="$emit('update:modelValue', false)"
      ></div>

      <div class="flex min-h-screen items-center justify-center p-4">
        <div
          class="relative w-full max-w-4xl transform overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) text-left shadow-2xl transition-all"
        >
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

          <div class="custom-scrollbar relative max-h-[70vh] overflow-y-auto p-6">
            <div
              v-if="initializationError"
              role="alert"
              class="border-danger/20 bg-danger/5 text-danger mb-4 rounded-xl border px-4 py-3 text-sm"
            >
              <div class="flex items-center justify-between gap-3">
                <span>{{ initializationError }}</span>
                <AppButton variant="secondary" :text="t('common.retry')" @click="$emit('retry-init')" />
              </div>
            </div>
            <form id="product-form" class="space-y-8" @submit.prevent="handleSubmit">
              <div class="space-y-6">
                <ProductBasicInfoSection :form="form" :currency-options="CURRENCY_OPTIONS" />

                <ProductOptionsBuilder
                  :options="form.options"
                  @add-option="addOption"
                  @remove-option="removeOption"
                  @add-value="addOptionValue"
                  @remove-value="removeOptionValue"
                  @restore-value="restoreOptionValue"
                  @batch-build="showVariantBatchBuilder = true"
                  @generate-variants="generateVariants"
                />

                <div
                  v-if="form.variants.length > 0"
                  class="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-4"
                >
                  <div
                    v-if="editMode && incompleteVariantCount > 0"
                    role="alert"
                    class="border-warning/30 bg-warning-bg/80 text-warning-text flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
                  >
                    <svg class="mt-0.5 size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l5.58 9.92c.75 1.334-.213 2.981-1.742 2.981H4.42c-1.53 0-2.492-1.647-1.743-2.98l5.58-9.921ZM11 7a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V7Zm-1 7a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 10 14Z" clip-rule="evenodd" />
                    </svg>
                    <span>{{ incompleteVariantsBannerMessage }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <h4 class="font-bold text-(--text-main)">
                      {{ t('product.form.variants_title', 'Variants') }}
                    </h4>
                    <button
                      type="button"
                      class="text-primary text-sm font-medium"
                      @click="showVariantImageManager = true"
                    >
                      {{ t('product.form.manage_variant_images', 'Manage Variant Images') }}
                    </button>
                  </div>
                  <ProductVariantTable
                    v-model="form.variants"
                    :currency-symbol="CURRENCY_SYMBOLS[form.currency] || '¥'"
                    :inventory-readonly="editMode"
                  />
                </div>

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
              :disabled="submitBlocked"
              @click="handleSubmit"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="initializing"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-(--color-overlay-dim)/70 backdrop-blur-sm"
    >
      <div class="w-full max-w-sm rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-2xl">
        <div class="flex items-start gap-3">
          <div class="bg-primary/10 text-primary mt-0.5 flex size-10 items-center justify-center rounded-full">
            <svg class="size-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.2" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-(--text-main)">
              {{ t('product.workflow.loading_title', 'Loading complete product data') }}
            </p>
            <p class="mt-1 text-sm text-(--text-secondary)">
              {{ t('product.workflow.loading_body', 'Syncing dimensions, variants, and inventory details.') }}
            </p>
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

    <DimensionArchiveModal
      :wizard="dimensionArchiveWizard"
      :format-variant-sample="formatVariantSample"
      @close="closeDimensionArchiveWizard"
      @confirm="confirmDimensionArchive"
    />

    <ValueArchiveModal
      :wizard="valueArchiveWizard"
      :format-variant-sample="formatVariantSample"
      @close="closeValueArchiveWizard"
      @confirm="confirmValueArchive"
    />
  </Teleport>

  <template v-if="embedded">
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

    <DimensionArchiveModal
      :wizard="dimensionArchiveWizard"
      :format-variant-sample="formatVariantSample"
      @close="closeDimensionArchiveWizard"
      @confirm="confirmDimensionArchive"
    />

    <ValueArchiveModal
      :wizard="valueArchiveWizard"
      :format-variant-sample="formatVariantSample"
      @close="closeValueArchiveWizard"
      @confirm="confirmValueArchive"
    />
  </template>
</template>

<script setup>
import { toRef, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useProductForm } from '@/composables/useProductForm';
import ImageUploader from '@/components/common/ImageUploader.vue';
import VariantImageManagerModal from '@/components/product/VariantImageManagerModal.vue';
import VariantBatchBuilderModal from '@/components/product/VariantBatchBuilderModal.vue';
import ProductVariantTable from '@/components/product/ProductVariantTable.vue';
import ProductBasicInfoSection from '@/components/product/ProductBasicInfoSection.vue';
import ProductOptionsBuilder from '@/components/product/ProductOptionsBuilder.vue';
import DimensionArchiveModal from '@/components/product/DimensionArchiveModal.vue';
import ValueArchiveModal from '@/components/product/ValueArchiveModal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import { CURRENCY_OPTIONS, CURRENCY_SYMBOLS } from '@/constants/currency.js';
import { API } from '@/utils/constants';
import { computed } from 'vue';

const { t } = useI18n();

const props = defineProps({
  modelValue: Boolean,
  editMode: Boolean,
  initialData: {
    type: Object,
    default: () => ({}),
  },
  embedded: {
    type: Boolean,
    default: false,
  },
  initializing: {
    type: Boolean,
    default: false,
  },
  initializationError: {
    type: String,
    default: '',
  },
});
const emit = defineEmits(['update:modelValue', 'success', 'retry-init']);

// 所有表单状态与逻辑由 composable 统一管理
const {
  form,
  imageObjects,
  submitting,
  showVariantImageManager,
  showVariantBatchBuilder,
  dimensionArchiveWizard,
  valueArchiveWizard,
  resetForm,
  fillFormFromData,
  addOption,
  removeOption,
  addOptionValue,
  removeOptionValue,
  restoreOptionValue,
  closeDimensionArchiveWizard,
  confirmDimensionArchive,
  closeValueArchiveWizard,
  confirmValueArchive,
  generateVariants,
  formatVariantSample,
  handleUpdateVariantImages,
  handleBatchBuilderApply,
  handleSubmit: submitForm,
  incompleteVariantCount,
  incompleteVariantsBannerMessage,
} = useProductForm({
  editMode: toRef(props, 'editMode'),
  initialData: toRef(props, 'initialData'),
  modelValue: toRef(props, 'modelValue'),
  emit,
});

const submitBlocked = computed(
  () => props.initializing || !!props.initializationError || (props.editMode && incompleteVariantCount.value > 0)
);

const handleSubmit = async () => {
  if (props.initializationError) return;
  await submitForm();
};

// 父组件唯一负责监听弹窗开/关并触发状态初始化
watch(
  [() => props.modelValue, () => props.initialData],
  ([isOpen]) => {
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
</script>
