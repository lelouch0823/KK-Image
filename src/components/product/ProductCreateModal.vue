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
                <!-- 基础信息 -->
                <ProductBasicInfoSection :form="form" :currency-options="CURRENCY_OPTIONS" />

                <!-- 选项维度构建器 -->
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

                <!-- 变体矩阵 -->
                <div
                  v-if="form.variants.length > 0"
                  class="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-4"
                >
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
                  />
                </div>

                <!-- 产品图片 -->
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

    <!-- 变体图片管理弹窗 -->
    <VariantImageManagerModal
      v-model="showVariantImageManager"
      :variants="form.variants"
      @update-images="handleUpdateVariantImages"
    />

    <!-- 批量构建变体弹窗 -->
    <VariantBatchBuilderModal
      v-model="showVariantBatchBuilder"
      :existing-variants="form.variants"
      @apply="handleBatchBuilderApply"
    />

    <!-- 维度归档向导 -->
    <DimensionArchiveModal
      :wizard="dimensionArchiveWizard"
      :format-variant-sample="formatVariantSample"
      @close="closeDimensionArchiveWizard"
      @confirm="confirmDimensionArchive"
    />

    <!-- 值归档确认弹窗 -->
    <ValueArchiveModal
      :wizard="valueArchiveWizard"
      :format-variant-sample="formatVariantSample"
      @close="closeValueArchiveWizard"
      @confirm="confirmValueArchive"
    />
  </Teleport>
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
import { API } from '@/utils/constants';

const { t } = useI18n();

const props = defineProps({
  modelValue: Boolean,
  editMode: Boolean,
  initialData: {
    type: Object,
    default: () => ({}),
  },
});
const emit = defineEmits(['update:modelValue', 'success']);

// 所有表单状态与逻辑由 composable 统一管理
const {
  form,
  imageObjects,
  submitting,
  showVariantImageManager,
  showVariantBatchBuilder,
  dimensionArchiveWizard,
  valueArchiveWizard,
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
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
  handleSubmit,
} = useProductForm({
  editMode: toRef(props, 'editMode'),
  initialData: toRef(props, 'initialData'),
  emit,
});

// 父组件唯一负责监听弹窗开/关并触发状态初始化
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
</script>
