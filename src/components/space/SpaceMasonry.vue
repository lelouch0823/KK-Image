<template>
  <div class="mx-auto max-w-7xl px-4 py-6 pb-20 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="mb-8 flex items-end justify-between">
      <div>
        <h1 class="text-2xl font-bold text-(--text-main)">{{ space.name }}</h1>
        <p v-if="space.description" class="mt-2 text-(--text-secondary)">{{ space.description }}</p>

        <div class="mt-4 flex items-center gap-4 text-sm text-(--text-secondary)">
          <span>{{ space.fileCount }} {{ t('spacePublic.files') }}</span>
          <span>{{ space.viewCount }} {{ t('spacePublic.views') }}</span>
        </div>
      </div>

      <AppButton
        v-if="hasFiles"
        :disabled="downloading"
        variant="primary"
        @click="handleDownloadAll"
      >
        <template #icon-left>
          <AppIcon v-if="downloading" name="spinner" class="size-4 animate-spin" />
          <AppIcon v-else name="arrow-down-tray" class="size-4" />
        </template>
        {{
          downloading
            ? `${t('spacePublic.packing')} ${downloadProgress}%`
            : t('spacePublic.downloadAllSimple')
        }}
      </AppButton>
    </div>

    <!-- Masonry Grid -->
    <div class="masonry-grid">
      <div
        v-for="(file, index) in space.files"
        :key="file.id"
        class="group relative mb-4 cursor-pointer break-inside-avoid overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-muted) transition-all hover:border-(--border-hover) hover:shadow-lg"
        @click="openLightbox(index)"
      >
        <!-- Image -->
        <AppImage
          v-if="isImage(file)"
          :src="file.url"
          :alt="file.name"
          :blurhash="file.blurhash"
          fit="cover"
          class="masonry-image h-auto w-full"
          rounded="none"
        />

        <!-- Other Files -->
        <div
          v-else
          class="flex aspect-square w-full flex-col items-center justify-center bg-(--bg-muted)"
        >
          <span class="mb-2 text-xs font-bold text-(--text-muted) uppercase">{{
            file.name.split('.').pop()
          }}</span>
          <span class="w-full truncate px-2 text-center text-xs text-(--text-secondary)">{{
            file.originalName || file.name
          }}</span>
        </div>

        <!-- Overlay -->
        <div
          class="absolute inset-0 flex items-end bg-(--color-overlay-dim) p-3 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <span class="w-full truncate text-xs font-medium text-(--text-inverse)">{{
            file.name
          }}</span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="space.files.length === 0" class="py-20 text-center text-(--text-secondary)">
      <p>{{ t('spacePublic.noContent') }}</p>
    </div>

    <!-- Lightbox (Reusing same logic or component ideally, simplified here) -->
    <div
      v-if="lightbox.visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-(--color-overlay-dim) backdrop-blur-sm"
      @click.self="lightbox.visible = false"
    >
      <AppImage
        v-if="lightbox.file && isImage(lightbox.file)"
        :src="lightbox.file.url"
        :alt="lightbox.file.name || '空间图片'"
        :blurhash="lightbox.file.blurhash"
        fit="contain"
        class="size-full max-h-screen max-w-screen p-4"
        rounded="none"
      />
      <AppButton
        variant="ghost"
        size="sm"
        class="absolute top-4 right-4 rounded-full bg-(--bg-card)/15 text-(--text-inverse) hover:!bg-(--bg-card)/25 hover:!text-(--text-inverse)"
        @click="lightbox.visible = false"
      >
        <AppIcon name="x-mark" class="size-6" />
      </AppButton>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { isImage } from '@/utils/formatters';
import { useBatchDownload } from '@/composables/useBatchDownload';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  space: { type: Object, required: true },
});

const { t } = useI18n();

const { downloading, downloadProgress, downloadAll } = useBatchDownload();
const lightbox = ref({ visible: false, file: null });

const hasFiles = computed(() => props.space.files && props.space.files.length > 0);

const openLightbox = (index) => {
  lightbox.value = { visible: true, file: props.space.files[index] };
};

const handleDownloadAll = () => {
  downloadAll(props.space.files, props.space.name);
};
</script>

<style scoped>
:deep(.masonry-image .app-image__img) {
  @apply transition-transform duration-500 group-hover:scale-105;
}

.masonry-grid {
  column-count: 2;
  column-gap: 1rem;
}

@media (min-width: 640px) {
  .masonry-grid {
    column-count: 3;
  }
}
@media (min-width: 1024px) {
  .masonry-grid {
    column-count: 4;
  }
}
@media (min-width: 1280px) {
  .masonry-grid {
    column-count: 5;
  }
}
</style>
