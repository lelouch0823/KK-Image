<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="border-border bg-surface rounded-2xl border p-8 shadow-lg">
        <div class="mb-6 text-center">
          <div
            class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--bg-muted)]"
          >
            <AppIcon name="lock-closed" class="text-secondary size-7" />
          </div>

          <h2 class="text-primary text-xl font-semibold">{{ t('gallery.passwordRequired') }}</h2>
          <p class="text-secondary mt-1 text-sm">{{ t('spacePublic.passwordProtected') }}</p>
        </div>
        <form @submit.prevent="handleSubmit">
          <input
            v-model="password"
            type="password"
            :placeholder="t('gallery.enterPassword')"
            class="focus:border-primary focus:bg-surface focus:outline-none border-border bg-surface-muted mb-4 h-12 w-full rounded-xl border px-4 text-sm transition-colors"
          />
          <button
            type="submit"
            class="bg-primary h-12 w-full rounded-xl font-medium text-[var(--text-inverse)] transition-colors hover:bg-[var(--color-primary-hover)]"
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
import AppIcon from '@/components/ui/AppIcon.vue';

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
