<template>
  <div class="flex min-h-screen items-center justify-center bg-(--bg-page) px-4">
    <div class="w-full max-w-sm">
      <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-8 shadow-lg">
        <div class="mb-6 text-center">
          <div
            class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-(--bg-muted)"
          >
            <AppIcon name="lock-closed" class="text-secondary size-7" />
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
            class="focus:border-primary focus:bg-(--bg-card) focus:outline-none mb-4 h-12 w-full rounded-xl border border-(--border-color) bg-(--bg-muted) px-4 text-sm transition-colors"
            autofocus
          />
          <button
            type="submit"
            :disabled="loading"
            class="bg-primary flex h-12 w-full items-center justify-center rounded-xl font-medium text-(--text-inverse) transition-colors hover:bg-(--color-primary-hover) disabled:opacity-50"
          >
            <AppIcon v-if="loading" name="spinner" class="mr-2 size-5 animate-spin" />
            {{ buttonText || t('common.confirm') }}
          </button>
        </form>
        <p v-if="error" class="mt-4 text-center text-sm text-danger">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

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
