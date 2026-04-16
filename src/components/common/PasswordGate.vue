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
          <AppInput
            v-model="passwordInput"
            type="password"
            :placeholder="placeholder || t('auth.passwordAccessPlaceholder')"
            class="mb-4"
            autofocus
          />
          <AppButton
            type="submit"
            :disabled="loading"
            class="!h-12 w-full !rounded-xl"
            :text="buttonText || t('common.confirm')"
          >
            <template v-if="loading" #icon-left>
              <AppIcon name="spinner" class="size-5 animate-spin" />
            </template>
          </AppButton>
        </form>
        <p v-if="error" class="text-danger mt-4 text-center text-sm">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';

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
