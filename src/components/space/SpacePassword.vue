<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="border-border bg-surface rounded-2xl border p-8 shadow-lg">
        <div class="mb-6 text-center">
          <div
            class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-(--bg-muted)"
          >
            <AppIcon name="lock-closed" class="text-secondary size-7" />
          </div>

          <h2 class="text-primary text-xl font-semibold">{{ t('gallery.passwordRequired') }}</h2>
          <p class="text-secondary mt-1 text-sm">{{ t('spacePublic.passwordProtected') }}</p>
        </div>
        <form @submit.prevent="handleSubmit">
          <AppInput
            v-model="password"
            type="password"
            size="lg"
            class="mb-4"
            :placeholder="t('gallery.enterPassword')"
          />
          <AppButton type="submit" variant="primary" size="lg" block>
            {{ t('gallery.confirm') }}
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
