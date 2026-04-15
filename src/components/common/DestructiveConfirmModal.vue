<template>
  <Modal
    :model-value="modelValue"
    size="md"
    :title="title"
    body-class="!p-0"
    :closable="!loading"
    :close-on-backdrop="!loading"
    @update:model-value="handleModelValueUpdate"
    @close="close"
  >
    <div class="space-y-6 p-6 sm:p-8">
      <div
        class="mx-auto flex size-12 items-center justify-center rounded-full bg-(--color-danger-bg)"
      >
        <AppIcon name="exclamation-triangle" class="text-danger size-6" />
      </div>

      <div class="space-y-2 text-center">
        <p class="text-sm leading-relaxed whitespace-pre-line text-(--text-secondary)">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium text-(--text-main)">
          {{ displayRequireTextLabel }}
          <span
            class="ml-1 rounded bg-(--bg-page) px-1 font-mono text-(--text-secondary) select-all"
          >
            {{ requiredText }}
          </span>
        </label>
        <AppInput
          ref="inputRef"
          v-model="inputValue"
          type="text"
          size="lg"
          :placeholder="requiredText"
          class="[&_input]:font-mono"
          @keyup.enter="handleConfirm"
        />
      </div>
    </div>

    <template #footer>
      <ActionBar class="w-full border-none bg-transparent px-0 py-0 shadow-none">
        <AppButton
          variant="secondary"
          :text="displayCancelText"
          :disabled="loading"
          @click="close"
        />
        <AppButton
          variant="danger"
          :text="displayConfirmText"
          :loading="loading"
          :disabled="!isValid"
          @click="handleConfirm"
        />
      </ActionBar>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';

const { t } = useI18n();

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, required: true },
  description: { type: String, default: '' },
  requiredText: { type: String, required: true },
  requireTextLabel: { type: String, default: '' },
  confirmText: { type: String, default: '' },
  cancelText: { type: String, default: '' },
  loading: Boolean,
});

const emit = defineEmits(['update:modelValue', 'confirm']);
const inputValue = ref('');
const inputRef = ref(null);

const isValid = computed(() => inputValue.value === props.requiredText);

const displayRequireTextLabel = computed(
  () => props.requireTextLabel || t('common.requireTextLabel') || 'Please type:'
);
const displayConfirmText = computed(() => props.confirmText || t('common.confirm') || 'Confirm');
const displayCancelText = computed(() => props.cancelText || t('common.cancel') || 'Cancel');

watch(
  () => props.modelValue,
  async (newVal) => {
    if (newVal) {
      inputValue.value = '';
      await nextTick();
      inputRef.value?.focus?.();
    }
  }
);

const close = () => {
  if (props.loading) return;
  emit('update:modelValue', false);
};

const handleModelValueUpdate = (nextValue) => {
  if (!nextValue) {
    close();
  }
};

const handleConfirm = () => {
  if (isValid.value && !props.loading) {
    emit('confirm');
  }
};
</script>
