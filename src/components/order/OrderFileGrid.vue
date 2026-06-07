<template>
  <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4">
    <div v-if="files && files.length > 0">
      <h3 class="text-primary mb-3 text-sm font-medium">{{ t('order.detail.images') }}</h3>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <div
          v-for="file in files"
          :key="file.id"
          class="aspect-square cursor-pointer overflow-hidden rounded-lg bg-(--bg-muted) transition-opacity hover:opacity-90"
          @click="$emit('preview', file)"
        >
          <AppImage
            :src="file.url"
            :alt="file.name || '订单文件'"
            :blurhash="file.blurhash"
            fit="cover"
            class="size-full"
            rounded="none"
          />
        </div>
      </div>
    </div>
    <div v-else class="flex flex-col items-center justify-center py-8 text-center">
      <AppIcon name="photo" class="mb-2 size-12 stroke-[1.5] text-(--text-secondary)/40" />
      <p class="text-sm text-(--text-secondary)">{{ t('order.detail.noImages') }}</p>
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
