<template>
  <div class="mx-auto max-w-7xl px-4 py-6 pb-20 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="mb-8 flex items-end justify-between">
      <div>
        <h1 class="text-primary text-2xl font-bold">{{ space.name }}</h1>
        <p v-if="space.description" class="text-secondary mt-2">{{ space.description }}</p>

        <div class="text-secondary mt-4 flex items-center gap-4 text-sm">
          <span>{{ space.fileCount }} {{ t('spacePublic.files') }}</span>
          <span>{{ space.viewCount }} {{ t('spacePublic.views') }}</span>
        </div>
      </div>

      <button
        v-if="hasFiles"
        :disabled="downloading"
        class="bg-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleDownloadAll"
      >
        <svg v-if="downloading" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <svg v-else class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          ></path>
        </svg>
        {{
          downloading
            ? `${t('spacePublic.packing')} ${downloadProgress}%`
            : t('spacePublic.downloadAllSimple')
        }}
      </button>
    </div>

    <!-- Masonry Grid -->
    <div class="masonry-grid">
      <div
        v-for="(file, index) in space.files"
        :key="file.id"
        class="group relative mb-4 cursor-pointer break-inside-avoid overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] transition-all hover:border-[var(--border-hover)] hover:shadow-lg"
        @click="openLightbox(index)"
      >
        <!-- Image -->
        <AppImage
          v-if="isImage(file)"
          :src="file.url"
          :alt="file.name"
          :blurhash="file.blurhash"
          fit="cover"
          class="h-auto w-full masonry-image"
          rounded="none"
        />

        <!-- Other Files -->
        <div
          v-else
          class="flex aspect-square w-full flex-col items-center justify-center bg-[var(--bg-muted)]"
        >
          <span class="mb-2 text-xs font-bold text-gray-400 uppercase">{{
            file.name.split('.').pop()
          }}</span>
          <span class="w-full truncate px-2 text-center text-xs text-gray-500">{{
            file.originalName || file.name
          }}</span>
        </div>

        <!-- Overlay -->
        <div
          class="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <span class="w-full truncate text-xs font-medium text-white">{{ file.name }}</span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="space.files.length === 0" class="text-secondary py-20 text-center">
      <p>{{ t('spacePublic.noContent') }}</p>
    </div>

    <!-- Lightbox (Reusing same logic or component ideally, simplified here) -->
    <div
      v-if="lightbox.visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      @click.self="lightbox.visible = false"
    >
      <img
        v-if="lightbox.file && isImage(lightbox.file)"
        :src="lightbox.file.url"
        class="max-h-full max-w-full object-contain p-4"
      />
      <button
        class="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        @click="lightbox.visible = false"
      >
        <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          ></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { isImage } from '@/utils/formatters';
import { useBatchDownload } from '@/composables/useBatchDownload';
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';

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
