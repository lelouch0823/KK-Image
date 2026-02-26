<template>
  <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
    <div v-if="files && files.length > 0">
      <h3 class="mb-3 text-sm font-medium text-[var(--color-primary)]">{{ t('order.detail.images') }}</h3>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <div
          v-for="file in files"
          :key="file.id"
          class="aspect-square cursor-pointer overflow-hidden rounded-lg bg-[var(--bg-muted)] transition-opacity hover:opacity-90"
          @click="$emit('preview', file)"
        >
          <AppImage 
            :src="file.url" 
            :blurhash="file.blurhash"
            fit="cover"
            class="size-full"
            rounded="none"
          />
        </div>
      </div>
    </div>
    <div
      v-else
      class="flex flex-col items-center justify-center py-8 text-center"
    >
      <AppIcon name="photo" class="mb-2 size-12 text-[var(--text-secondary)]/40 stroke-[1.5]" />
      <p class="text-sm text-[var(--text-secondary)]">{{ t('order.detail.noImages') }}</p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({
  files: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['preview']);

const { t } = useI18n();
</script>
