<!-- eslint-disable vue/no-mutating-props -->
<template>
  <!-- 值归档确认弹窗 -->
  <Modal
    :model-value="wizard.open"
    size="lg"
    :closable="!wizard.loading"
    @update:model-value="
      (value) => {
        if (!value) $emit('close');
      }
    "
  >
    <div data-testid="value-archive-modal" class="relative">
      <h4 class="text-lg font-bold text-(--text-main)">
        {{ t('product.form.archive_value_title', 'Archive Value') }}
      </h4>
      <p class="mt-2 text-sm text-(--text-secondary)">
        {{ t('product.form.archive_value_impact', 'This action will affect variants:') }}
        <span class="font-semibold text-(--text-main)">{{ wizard.affectedVariantsCount }}</span>
      </p>
      <p class="mt-1 text-xs text-(--text-secondary)">
        {{
          t(
            'product.form.archive_value_hint',
            'Archived values will not be used for new combinations.'
          )
        }}
      </p>

      <!-- 样本变体展示 -->
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

      <!-- Footer 操作按钮 -->
      <div class="mt-5 flex justify-end gap-2">
        <AppButton variant="white" size="sm" :disabled="wizard.loading" @click="$emit('close')">
          {{ t('common.cancel', 'Cancel') }}
        </AppButton>
        <AppButton
          data-testid="value-archive-confirm"
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
import Modal from '@/components/ui/Modal.vue';

const { t } = useI18n();

defineProps({
  // valueArchiveWizard reactive 对象
  wizard: { type: Object, required: true },
  // 用于显示样本变体摘要的格式化函数
  formatVariantSample: { type: Function, required: true },
});

defineEmits(['close', 'confirm']);
</script>
