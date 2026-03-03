<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-0">
        <div class="fixed inset-0 bg-(--color-overlay-blur) backdrop-blur-sm transition-opacity" @click="close"></div>
        <div class="relative w-full max-w-md transform overflow-hidden rounded-2xl border border-(--border-danger) bg-(--bg-card) shadow-xl transition-all">
          <div class="p-6 sm:p-8">
            <div class="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-(--color-danger-bg)">
              <svg class="text-danger size-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 class="mb-2 text-center text-lg leading-6 font-bold text-(--text-main)">
              {{ title }}
            </h3>
            <div class="mt-2 text-center">
              <p class="text-sm leading-relaxed whitespace-pre-line text-(--text-secondary)">
                <slot name="description">{{ description }}</slot>
              </p>
            </div>

            <div class="mt-6">
              <label class="mb-1 block text-sm font-medium text-(--text-main)">
                {{ displayRequireTextLabel }} <span class="rounded bg-(--bg-page) px-1 font-mono text-(--text-secondary) select-all">{{ requiredText }}</span>
              </label>
              <input 
                ref="inputRef"
                v-model="inputValue" 
                type="text"
                :placeholder="requiredText"
                class="focus:border-danger focus:ring-4 focus:ring-(--border-danger) w-full rounded-xl border border-(--border-color) bg-(--bg-muted) px-4 py-2.5 font-mono text-sm text-(--text-main) transition-all outline-none"
                @keyup.enter="handleConfirm"
              />
            </div>
          </div>
          
          <div class="flex flex-col-reverse gap-3 bg-(--bg-page)/50 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button
              type="button"
              class="focus:ring-primary focus:ring-2 focus:ring-offset-2 focus:outline-none inline-flex w-full items-center justify-center rounded-xl border border-(--border-color) bg-(--bg-card) px-4 py-2 text-sm font-semibold text-(--text-main) shadow-sm transition-colors hover:bg-(--bg-muted) disabled:opacity-50 sm:w-auto"
              :disabled="loading"
              @click="close"
            >
              {{ displayCancelText }}
            </button>
             <button
              type="button"
              class="bg-danger inline-flex w-full items-center justify-center rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors focus:ring-danger focus:ring-2 focus:ring-offset-2 focus:outline-none hover:bg-(--color-danger-text) disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              :disabled="!isValid || loading"
              @click="handleConfirm"
            >
              <svg v-if="loading" class="mr-2 -ml-1 size-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ displayConfirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, required: true },
  description: { type: String, default: '' },
  requiredText: { type: String, required: true },
  requireTextLabel: { type: String, default: '' },
  confirmText: { type: String, default: '' },
  cancelText: { type: String, default: '' },
  loading: Boolean
});

const emit = defineEmits(['update:modelValue', 'confirm']);
const inputValue = ref('');
const inputRef = ref(null);

const isValid = computed(() => inputValue.value === props.requiredText);

const displayRequireTextLabel = computed(() => props.requireTextLabel || t('common.requireTextLabel') || 'Please type:');
const displayConfirmText = computed(() => props.confirmText || t('common.confirm') || 'Confirm');
const displayCancelText = computed(() => props.cancelText || t('common.cancel') || 'Cancel');

watch(() => props.modelValue, async (newVal) => {
  if (newVal) {
    inputValue.value = '';
    await nextTick();
    if (inputRef.value) {
      inputRef.value.focus();
    }
  }
});

const close = () => {
  if (props.loading) return;
  emit('update:modelValue', false);
};

const handleConfirm = () => {
  if (isValid.value && !props.loading) {
    emit('confirm');
  }
};
</script>
