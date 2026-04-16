<template>
  <slot v-if="!hasError"></slot>

  <div v-else data-testid="error-fallback">
    <AsyncStatePanel
      state="error"
      :title="t('common.loadFailed')"
      :description="errorMessage"
      :error="errorMessage"
      @retry="recover"
    >
      <template #actions>
        <AppButton
          variant="outline"
          data-testid="back-action"
          :text="t('order.detail.backToList') || '返回列表'"
          @click="$emit('back')"
        />
      </template>
    </AsyncStatePanel>
  </div>
</template>

<script setup>
import { ref, onErrorCaptured, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AsyncStatePanel from '@/components/common/AsyncStatePanel.vue';
import AppButton from '@/components/ui/AppButton.vue';

const props = defineProps({
  resetKey: { type: [String, Number], default: '' },
});

const emit = defineEmits(['recover', 'error', 'back']);
const { t } = useI18n();

const hasError = ref(false);
const errorMessage = ref('');

const reset = () => {
  hasError.value = false;
  errorMessage.value = '';
};

const recover = () => {
  reset();
  emit('recover');
};

onErrorCaptured((err) => {
  hasError.value = true;
  errorMessage.value = err?.message || t('common.networkError');
  emit('error', err);
  return false;
});

watch(
  () => props.resetKey,
  () => {
    reset();
  }
);
</script>
