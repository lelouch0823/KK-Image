<template>
  <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
    <div v-if="files && files.length > 0">
      <h3 class="text-primary mb-3 text-sm font-medium">{{ t('order.detail.images') }}</h3>
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
      <svg
        class="text-secondary/40 mb-2 size-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p class="text-secondary text-sm">{{ t('order.detail.noImages') }}</p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';

defineProps({
  files: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['preview']);

const { t } = useI18n();
</script>
