<template>
  <div class="space-y-6">
    <!-- 标题 -->
    <div class="text-center">
      <h2 class="text-primary text-xl font-bold">{{ t('order.portal.newOrder') }}</h2>
      <p class="text-secondary mt-1 text-sm">{{ t('order.portal.subtitle') }}</p>
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- 图片上传 -->
      <ImageUploader
        v-model="uploadedFiles"
        :label="t('order.form.uploadImages')"
        :hint="t('order.form.uploadHint')"
        :upload-endpoint="uploadEndpoint"
        :deferred="true"
      />

      <!-- 商品信息 -->
      <div class="space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <!-- 商品名称 -->
        <div>
          <label class="text-primary mb-2 block text-sm font-medium">
            {{ t('order.form.productName') }} <span class="text-danger">*</span>
          </label>
          <AutocompleteInput
            v-model="form.name"
            :suggestions="nameSuggestions"
            :placeholder="t('order.form.productNamePlaceholder')"
            :label="t('order.form.recentInputs')"
            :filter-mode="false"
            input-class="input h-11"
          />
        </div>

        <!-- 品牌和系列 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('order.form.brand') }}
            </label>
            <AutocompleteInput
              v-model="form.brand"
              :suggestions="brandSuggestions"
              :placeholder="t('order.form.brandPlaceholder')"
              :label="t('order.form.recentInputs')"
              :filter-mode="false"
              input-class="input h-11"
            />
          </div>
          <div>
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('order.form.series') }}
            </label>
            <AutocompleteInput
              v-model="form.series"
              :suggestions="seriesSuggestions"
              :placeholder="t('order.form.seriesPlaceholder')"
              :label="t('order.form.recentInputs')"
              :filter-mode="false"
              input-class="input h-11"
            />
          </div>
        </div>

        <!-- 规格尺寸 -->
        <div>
          <label class="text-primary mb-2 block text-sm font-medium">
            {{ t('order.form.size') }}
          </label>
          <input
            v-model="form.size"
            type="text"
            :placeholder="t('order.form.sizePlaceholder')"
            class="input h-11"
          />
        </div>

        <!-- 颜色材质 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('order.form.color') }}
            </label>
            <AutocompleteInput
              v-model="form.color"
              :suggestions="colorSuggestions"
              :placeholder="t('order.form.colorPlaceholder')"
              :label="t('order.form.recentInputs')"
              :filter-mode="false"
              input-class="input h-11"
            />
          </div>
          <div>
            <label class="text-primary mb-2 block text-sm font-medium">
              {{ t('order.form.material') }}
            </label>
            <AutocompleteInput
              v-model="form.material"
              :suggestions="materialSuggestions"
              :placeholder="t('order.form.materialPlaceholder')"
              :label="t('order.form.recentInputs')"
              :filter-mode="false"
              input-class="input h-11"
            />
          </div>
        </div>

        <!-- 备注 -->
        <div>
          <label class="text-primary mb-2 block text-sm font-medium">
            {{ t('order.form.remark') }}
          </label>
          <textarea
            v-model="form.remark"
            rows="3"
            :placeholder="t('order.form.remarkPlaceholder')"
            class="input h-auto resize-none py-3"
          ></textarea>
        </div>

        <!-- 期望到货时间 -->
        <div>
          <label class="text-primary mb-2 block text-sm font-medium">
            {{ t('order.form.expectedArrival') }}
          </label>
          <input
            v-model="form.deadline"
            type="date"
            :min="minDate"
            class="input h-11 appearance-none bg-[var(--bg-card)]"
            :class="{ 'text-muted': !form.deadline }"
          />
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3">
        <button
          type="button"
          class="text-secondary h-12 flex-1 rounded-xl border border-[var(--border-color)] font-medium transition-colors hover:bg-[var(--bg-hover)]"
          @click="$emit('cancel')"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="submit"
          :disabled="!isValid || isSubmitting"
          class="bg-primary shadow-primary/20 flex h-12 flex-1 items-center justify-center gap-2 rounded-xl font-medium text-white shadow-lg transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            v-if="isSubmitting"
            class="size-5 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
          {{ progressText }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { watch, toRef } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useOrderForm } from '@/composables/useOrderForm';
import ImageUploader from '../common/ImageUploader.vue';
import AutocompleteInput from '../ui/AutocompleteInput.vue';

const props = defineProps({
  prefill: { type: Object, default: null },
  submitProgress: { type: Object, default: () => ({ step: '', current: 0, total: 0 }) },
});

const emit = defineEmits(['submit', 'cancel']);

const { t } = useI18n();

// 使用 composable 管理表单逻辑
const {
  form,
  uploadedFiles,
  isSubmitting,
  minDate,
  isValid,
  progressText,
  uploadEndpoint,
  nameSuggestions,
  brandSuggestions,
  seriesSuggestions,
  colorSuggestions,
  materialSuggestions,
  fillForm,
  getSubmitData,
  saveHistory,
  setSubmitting,
} = useOrderForm({
  submitProgress: toRef(props, 'submitProgress'),
});

// 监听预填充数据变化
watch(
  () => props.prefill,
  (data) => {
    fillForm(data);
  },
  { immediate: true }
);

// 提交表单
const handleSubmit = async () => {
  if (!isValid.value || isSubmitting.value) return;

  setSubmitting(true);
  try {
    await emit('submit', getSubmitData());
    saveHistory();
  } finally {
    setSubmitting(false);
  }
};
</script>
