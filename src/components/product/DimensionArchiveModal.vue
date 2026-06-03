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
          <p class="mb-1 text-xs font-semibold text-(--text-secondary)">
            {{ t('product.form.sample_variants', 'Sample variants') }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="sample in wizard.sampleVariants"
              :key="sample.id"
              class="inline-flex items-center rounded-full border border-(--border-color) px-2 py-0.5 text-xs text-(--text-main)"
            >
              {{ formatVariantSample(sample) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Step 2: 策略选择 -->
      <div v-else class="mt-4 space-y-2">
        <AppCard
          clickable
          data-testid="dimension-archive-mode-archive"
          :selected="wizard.mode === 'archive_variants'"
          class="flex items-start gap-3"
          padding="p-3"
          role="radio"
          :aria-checked="wizard.mode === 'archive_variants'"
          @click="wizard.mode = 'archive_variants'"
        >
          <div
            class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors"
            :class="wizard.mode === 'archive_variants' ? 'border-primary bg-primary/10 text-primary' : 'border-(--border-color) text-transparent'"
          >
            <span class="size-2 rounded-full bg-current"></span>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-(--text-main)">
              {{ t('product.form.archive_affected_variants', 'Archive affected variants') }}
            </p>
            <p class="text-xs text-(--text-secondary)">
              {{ t('product.form.archive_affected_variants_desc', 'Safe default for edit flow.') }}
            </p>
          </div>
        </AppCard>
        <AppCard
          clickable
          data-testid="dimension-archive-mode-merge"
          :selected="wizard.mode === 'merge_keep'"
          class="flex items-start gap-3"
          padding="p-3"
          role="radio"
          :aria-checked="wizard.mode === 'merge_keep'"
          @click="wizard.mode = 'merge_keep'"
        >
          <div
            class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors"
            :class="wizard.mode === 'merge_keep' ? 'border-primary bg-primary/10 text-primary' : 'border-(--border-color) text-transparent'"
          >
            <span class="size-2 rounded-full bg-current"></span>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-(--text-main)">
              {{ t('product.form.merge_and_keep', 'Merge & keep') }}
            </p>
            <p class="text-xs text-(--text-secondary)">
              {{ t('product.form.merge_and_keep_desc', 'Ignore removed dimension and dedupe by signature.') }}
            </p>
          </div>
        </AppCard>
      </div>

      <!-- Footer 操作按钮 -->
      <div class="mt-5 flex justify-end gap-2">
        <AppButton
          variant="white"
          size="sm"
          :disabled="wizard.loading"
          @click="$emit('close')"
        >
          {{ t('common.cancel', 'Cancel') }}
        </AppButton>
        <AppButton
          v-if="wizard.step === 2"
          variant="outline"
          size="sm"
          :disabled="wizard.loading"
          @click="wizard.step = 1"
        >
          {{ t('common.back', 'Back') }}
        </AppButton>
        <AppButton
          v-if="wizard.step === 1"
          data-testid="dimension-archive-next"
          variant="primary"
          size="sm"
          :disabled="wizard.loading"
          @click="wizard.step = 2"
        >
          {{ t('common.next', 'Next') }}
        </AppButton>
        <AppButton
          v-else
          data-testid="dimension-archive-confirm"
          variant="danger"
          size="sm"
          :disabled="wizard.loading"
          :loading="wizard.loading"
          :loading-text="t('common.processing', 'Processing...')"
          @click="$emit('confirm')"
        >
          {{ t('common.confirm', 'Confirm') }}
        </AppButton>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
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
