<!-- eslint-disable vue/no-mutating-props -->
<template>
  <!-- 维度归档两步向导弹窗 -->
  <Modal
    :model-value="wizard.open"
    size="lg"
    :closable="!wizard.loading"
    @update:model-value="(value) => { if (!value) $emit('close'); }"
  >
    <div data-testid="dimension-archive-modal" class="relative">
      <h4 class="text-lg font-bold text-(--text-main)">
        {{ t('product.form.archive_dimension_title', 'Archive Dimension') }}
      </h4>
      <p class="mt-2 text-xs text-(--text-secondary)">
        {{ t('product.form.step_label', 'Step') }} {{ wizard.step }} / 2
      </p>

      <!-- Step 1: 影响预览 -->
      <div v-if="wizard.step === 1">
        <p class="mt-2 text-sm text-(--text-secondary)">
          {{ t('product.form.archive_dimension_impact', 'This action will affect variants:') }}
          <span class="font-semibold text-(--text-main)">{{ wizard.affectedVariantsCount }}</span>
        </p>
        <p class="mt-1 text-xs text-(--text-secondary)">
          {{ t('product.form.archive_dimension_hint', 'Preview impact first, then choose action strategy.') }}
        </p>
        <div
          v-if="wizard.sampleVariants.length > 0"
          class="mt-3 rounded-lg border border-(--border-color) bg-(--bg-page) p-2"
        >
          <p class="mb-1 text-[10px] font-semibold text-(--text-secondary)">
            {{ t('product.form.sample_variants', 'Sample variants') }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="sample in wizard.sampleVariants"
              :key="sample.id"
              class="inline-flex items-center rounded-full border border-(--border-color) px-2 py-0.5 text-[11px] text-(--text-main)"
            >
              {{ formatVariantSample(sample) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Step 2: 策略选择 -->
      <div v-else class="mt-4 space-y-2">
        <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-(--border-color) p-3">
          <input
            v-model="wizard.mode"
            data-testid="dimension-archive-mode-archive"
            type="radio"
            value="archive_variants"
            class="mt-0.5"
          />
          <div>
            <p class="text-sm font-medium text-(--text-main)">
              {{ t('product.form.archive_affected_variants', 'Archive affected variants') }}
            </p>
            <p class="text-xs text-(--text-secondary)">
              {{ t('product.form.archive_affected_variants_desc', 'Safe default for edit flow.') }}
            </p>
          </div>
        </label>
        <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-(--border-color) p-3">
          <input
            v-model="wizard.mode"
            data-testid="dimension-archive-mode-merge"
            type="radio"
            value="merge_keep"
            class="mt-0.5"
          />
          <div>
            <p class="text-sm font-medium text-(--text-main)">
              {{ t('product.form.merge_and_keep', 'Merge & keep') }}
            </p>
            <p class="text-xs text-(--text-secondary)">
              {{ t('product.form.merge_and_keep_desc', 'Ignore removed dimension and dedupe by signature.') }}
            </p>
          </div>
        </label>
      </div>

      <!-- Footer 操作按钮 -->
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-(--border-color) px-3 py-2 text-sm text-(--text-main)"
          :disabled="wizard.loading"
          @click="$emit('close')"
        >
          {{ t('common.cancel', 'Cancel') }}
        </button>
        <button
          v-if="wizard.step === 2"
          type="button"
          class="rounded-lg border border-(--border-color) px-3 py-2 text-sm text-(--text-main)"
          :disabled="wizard.loading"
          @click="wizard.step = 1"
        >
          {{ t('common.back', 'Back') }}
        </button>
        <button
          v-if="wizard.step === 1"
          data-testid="dimension-archive-next"
          type="button"
          class="rounded-lg bg-primary px-3 py-2 text-sm text-white"
          :disabled="wizard.loading"
          @click="wizard.step = 2"
        >
          {{ t('common.next', 'Next') }}
        </button>
        <button
          v-else
          data-testid="dimension-archive-confirm"
          type="button"
          class="rounded-lg bg-danger px-3 py-2 text-sm text-white disabled:opacity-60"
          :disabled="wizard.loading"
          @click="$emit('confirm')"
        >
          {{ wizard.loading ? t('common.processing', 'Processing...') : t('common.confirm', 'Confirm') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';

const { t } = useI18n();

defineProps({
  // dimensionArchiveWizard reactive 对象
  wizard: { type: Object, required: true },
  // 用于显示样本变体摘要的格式化函数
  formatVariantSample: { type: Function, required: true },
});

defineEmits(['close', 'confirm']);
</script>
