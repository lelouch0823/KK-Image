<template>
  <div class="flex min-h-screen items-center justify-center bg-[var(--bg-page)] px-4">
    <div class="w-full max-w-sm">
      <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 shadow-lg">
        <div class="mb-6 text-center">
          <div
            class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--bg-muted)]"
          >
            <svg
              class="text-secondary size-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              ></path>
            </svg>
          </div>
          <h2 class="text-primary text-xl font-semibold">
            {{ title || t('auth.passwordRequired') }}
          </h2>
          <p class="text-secondary mt-1 text-sm">{{ subtitle || t('auth.passwordSubtitle') }}</p>
        </div>
        <form @submit.prevent="handleSubmit">
          <input
            v-model="passwordInput"
            type="password"
            :placeholder="placeholder || t('auth.passwordAccessPlaceholder')"
            class="focus:border-primary focus:bg-[var(--bg-card)] focus:outline-none mb-4 h-12 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] px-4 text-sm transition-colors"
            autofocus
          />
          <button
            type="submit"
            :disabled="loading"
            class="bg-primary flex h-12 w-full items-center justify-center rounded-xl font-medium text-[var(--text-inverse)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            <svg
              v-if="loading"
              class="mr-2 size-5 animate-spin"
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
            {{ buttonText || t('common.confirm') }}
          </button>
        </form>
        <p v-if="error" class="mt-4 text-center text-sm text-[var(--color-danger)]">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  buttonText: { type: String, default: '' },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['submit']);

const passwordInput = ref('');

const handleSubmit = () => {
  if (!passwordInput.value) return;
  emit('submit', passwordInput.value);
};
</script>
