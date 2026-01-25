<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="rounded-2xl border border-border bg-surface p-8 shadow-lg">
        <div class="mb-6 text-center">
          <div
            class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-gray-100"
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
          <h2 class="text-primary text-xl font-semibold">{{ t('gallery.passwordRequired') }}</h2>
          <p class="text-secondary mt-1 text-sm">{{ t('spacePublic.passwordProtected') }}</p>
        </div>
        <form @submit.prevent="handleSubmit">
          <input
            v-model="password"
            type="password"
            :placeholder="t('gallery.enterPassword')"
            class="focus:border-primary focus:bg-surface focus:outline-none mb-4 h-12 w-full rounded-xl border border-border bg-surface-muted px-4 text-sm transition-colors"
          />
          <button
            type="submit"
            class="bg-primary h-12 w-full rounded-xl font-medium text-white transition-colors hover:bg-gray-800"
          >
            {{ t('gallery.confirm') }}
          </button>
        </form>
        <p v-if="error" class="mt-4 text-center text-sm text-red-500">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  error: { type: String, default: '' },
  onSubmit: { type: Function, default: () => {} },
});

const { t } = useI18n();
const password = ref('');

const handleSubmit = () => {
  if (password.value) {
    props.onSubmit(password.value);
  }
};
</script>
