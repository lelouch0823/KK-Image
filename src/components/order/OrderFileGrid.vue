<template>
  <div class="border-(--border-color) bg-(--bg-card) rounded-xl border p-4">
    <div v-if="files && files.length > 0">
      <h3 class="mb-3 text-sm font-medium text-primary">{{ t('order.detail.images') }}</h3>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <div
          v-for="file in files"
          :key="file.id"
          class="bg-(--bg-muted) aspect-square cursor-pointer overflow-hidden rounded-lg transition-opacity hover:opacity-90"
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
      <AppIcon name="photo" class="text-(--text-secondary)/40 mb-2 size-12 stroke-[1.5]" />
      <p class="text-(--text-secondary) text-sm">{{ t('order.detail.noImages') }}</p>
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
