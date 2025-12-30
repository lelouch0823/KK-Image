<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-[var(--bg-page)]">
    <div class="w-full max-w-sm">
      <div class="bg-white rounded-2xl border border-[var(--border-color)] shadow-lg p-8">
        <div class="text-center mb-6">
          <div class="w-14 h-14 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg class="w-7 h-7 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-primary">{{ title || t('auth.passwordRequired') }}</h2>
          <p class="text-sm text-secondary mt-1">{{ subtitle || t('auth.passwordSubtitle') }}</p>
        </div>
        <form @submit.prevent="handleSubmit">
          <input 
            v-model="passwordInput" 
            type="password" 
            :placeholder="placeholder || t('auth.passwordAccessPlaceholder')"
            class="w-full h-12 px-4 text-sm border border-[var(--border-color)] rounded-xl bg-[var(--bg-muted)] focus:bg-white focus:border-primary focus:outline-none mb-4 transition-colors"
            autofocus
          >
          <button 
            type="submit"
            :disabled="loading"
            class="w-full h-12 bg-primary text-white font-medium rounded-xl hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            <svg v-if="loading" class="w-5 h-5 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ buttonText || t('common.confirm') }}
          </button>
        </form>
        <p v-if="error" class="text-[var(--color-danger)] text-sm text-center mt-4">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps({
  title: String,
  subtitle: String,
  placeholder: String,
  buttonText: String,
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['submit']);

const passwordInput = ref('');

const handleSubmit = () => {
  if (!passwordInput.value) return;
  emit('submit', passwordInput.value);
};
</script>
