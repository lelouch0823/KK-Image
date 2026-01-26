<template>
  <div class="mx-auto max-w-7xl px-4 py-8 pb-20 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-8 lg:flex-row lg:gap-12">
      <!-- Left: Media Gallery -->
      <div class="w-full space-y-4 lg:w-2/3">
        <!-- Main Image -->
        <div
          class="group border-border bg-surface-muted relative aspect-video touch-pan-y overflow-hidden rounded-2xl border shadow-sm"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
        >
          <AppImage
            v-if="currentFile && isImage(currentFile)"
            :src="currentFile.url"
            :blurhash="currentFile.blurhash"
            fit="contain"
            class="bg-surface size-full select-none"
            rounded="none"
          />
          <div v-else class="text-secondary flex size-full items-center justify-center">
            {{ t('spacePublic.noPreview') }}
          </div>

          <!-- Navigation Arrows (Hidden on mobile) -->
          <button
            v-if="hasMultipleFiles"
            class="bg-surface/80 text-secondary-text absolute top-1/2 left-4 hidden -translate-y-1/2 rounded-full p-2 opacity-0 shadow-md transition-opacity hover:bg-surface group-hover:opacity-100 lg:flex"
            @click="prevImage"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              ></path>
            </svg>
          </button>
          <button
            v-if="hasMultipleFiles"
            class="absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-full bg-[var(--bg-card)]/80 p-2 text-[var(--text-secondary)] opacity-0 shadow-md transition-opacity group-hover:opacity-100 hover:bg-[var(--bg-card)] lg:flex"
            @click="nextImage"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              ></path>
            </svg>
          </button>

          <!-- Mobile Indicators -->
          <div
            v-if="hasMultipleFiles"
            class="pointer-events-none absolute right-0 bottom-3 left-0 flex justify-center gap-1.5 lg:hidden"
          >
            <span
              v-for="(file, idx) in space.files"
              :key="file.id"
              class="size-1.5 rounded-full transition-all"
              :class="currentIndex === idx ? 'w-3 bg-white' : 'bg-white/50'"
            ></span>
          </div>
        </div>

        <!-- Thumbnails -->
        <div v-if="hasMultipleFiles" class="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
          <button
            v-for="(file, index) in space.files"
            :key="file.id"
            class="relative size-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all"
            :class="
              currentIndex === index
                ? 'border-primary ring-primary/20 ring-2'
                : 'border-transparent'
            "
            @click="currentIndex = index"
          >
            <AppImage
              v-if="isImage(file)"
              :src="file.url"
              :blurhash="file.blurhash"
              fit="cover"
              class="size-full"
              rounded="none"
            />
            <div
              v-else
              class="bg-surface-muted text-secondary-text flex size-full items-center justify-center text-xs font-bold uppercase"
            >
              {{ file.name.split('.').pop() }}
            </div>
          </button>
        </div>
      </div>

      <!-- Right: Product Info -->
      <div class="w-full space-y-8 lg:w-1/3">
        <div>
          <div
            v-if="templateData.brand"
            class="text-primary bg-surface-muted mb-2 inline-block rounded px-2 py-1 text-sm font-medium"
          >
            {{ templateData.brand }}
          </div>
          <h1 class="text-main text-3xl leading-tight font-bold">{{ space.name }}</h1>
          <p v-if="templateData.series" class="text-secondary mt-1 text-lg">
            {{ templateData.series }}
          </p>
          <p v-if="templateData.sku" class="mt-2 font-mono text-xs text-gray-400">
            SKU: {{ templateData.sku }}
          </p>
        </div>

        <div v-if="templateData.price" class="flex items-baseline gap-1">
          <span class="text-sm text-[var(--text-secondary)]">¥</span>
          <span class="text-main text-3xl font-bold">{{
            formatPrice(templateData.price)
          }}</span>
        </div>

        <!-- SOTA Product Parameters Table -->
        <div class="border-b border-[var(--border-color)] pb-6">
          <dl class="grid grid-cols-1 gap-4  sm:grid-cols-2">
            <div
              v-if="templateData.brand"
              class="border-primary-light border-l-2 pl-3"
            >
              <dt class="text-secondary-text text-sm font-medium">{{ t('spaceManager.brand') }}</dt>
              <dd class="text-main mt-1 text-sm font-semibold">{{ templateData.brand }}</dd>
            </div>
            <div
              v-if="templateData.series"
              class="border-l-2 border-[var(--color-primary-light,rgba(59,130,246,0.5))] pl-3"
            >
            >
              <dt class="text-sm font-medium text-[var(--text-secondary)]">{{ t('spaceManager.series') }}</dt>
              <dd class="mt-1 text-sm font-semibold text-[var(--text-primary)]">{{ templateData.series }}</dd>
            </div>
            <div
              v-if="templateData.material"
              class="border-l-2 border-[var(--color-primary-light,rgba(59,130,246,0.5))] pl-3"
            >
            >
              <dt class="text-sm font-medium text-[var(--text-secondary)]">{{ t('spaceManager.material') }}</dt>
              <dd class="mt-1 text-sm font-semibold text-[var(--text-primary)]">{{ templateData.material }}</dd>
            </div>
            <div
              v-if="templateData.sku"
              class="border-l-2 border-[var(--color-primary-light,rgba(59,130,246,0.5))] pl-3"
            >
            >
              <dt class="text-sm font-medium text-[var(--text-secondary)]">SKU</dt>
              <dd class="mt-1 text-sm font-semibold break-all text-[var(--text-primary)]">
                {{ templateData.sku }}
              </dd>
            </div>
          </dl>
        </div>

        <div v-if="space.description" class="prose prose-sm prose-gray dark:prose-invert text-secondary-text max-w-none">
          <h3 class="text-main text-sm font-medium">{{ t('spacePublic.description') }}</h3>
          <p class="whitespace-pre-line">{{ space.description }}</p>
        </div>

        <div class="hidden space-y-3 border-t border-[var(--border-color)] pt-6 lg:block">
          <a
            v-if="currentFile"
            :href="currentFile.url"
            download
            class="bg-primary shadow-primary/20 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-white shadow-lg transition-colors hover:bg-primary-hover"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              ></path>
            </svg>
            {{ t('spacePublic.downloadCurrent') }}
          </a>

          <button
            v-if="hasMultipleFiles"
            :disabled="downloading"
            class="text-primary border-border bg-surface flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-medium transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            @click="handleDownloadAll"
          >
            <svg
              v-if="downloading"
              class="text-primary size-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
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
            <svg v-else class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                : t('spacePublic.downloadAll')
            }}
          </button>

          <p class="mt-3 text-center text-xs text-gray-400">
            {{ space.viewCount }} {{ t('spacePublic.views') }} • {{ space.downloadCount }}
            {{ t('spacePublic.downloads') }}
          </p>
        </div>
      </div>
    </div>

    <!-- SOTA Mobile Sticky Bottom Bar -->
    <div
      class="border-border bg-surface fixed right-0 bottom-0 left-0 z-50 flex items-center gap-3 border-t p-4 pb-[env(safe-area-inset-bottom,20px)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:hidden"
    >
      <div class="flex flex-1 gap-2">
        <a
          v-if="currentFile"
          :href="currentFile.url"
          download
          class="text-primary bg-surface-muted flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-medium transition-transform active:scale-95"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            ></path>
          </svg>
          <span class="text-sm">{{ t('spacePublic.download') }}</span>
        </a>

        <button
          v-if="hasMultipleFiles"
          :disabled="downloading"
          class="bg-primary shadow-primary/20 flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-medium text-white shadow-lg transition-transform active:scale-95 disabled:scale-100 disabled:opacity-50"
          @click="handleDownloadAll"
        >
          <svg v-if="downloading" class="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
          <svg v-else class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            ></path>
          </svg>
          <span class="text-sm text-nowrap">{{
            downloading ? `${downloadProgress}%` : t('spacePublic.downloadAll')
          }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { isImage } from '@/utils/formatters';
import { useBatchDownload } from '@/composables/useBatchDownload';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';

const props = defineProps({
  space: { type: Object, required: true },
});

const { addToast } = useToast();
const { t } = useI18n();
const { downloading, downloadProgress, downloadAll } = useBatchDownload();

const templateData = computed(() => props.space.templateData || {});

// 初始化索引：优先定位到封面图，否则默认第一张
const getCoverIndex = () => {
  if (props.space.coverFileId && props.space.files) {
    const idx = props.space.files.findIndex((f) => f.id === props.space.coverFileId);
    return idx >= 0 ? idx : 0;
  }
  return 0;
};
const currentIndex = ref(getCoverIndex());

const hasMultipleFiles = computed(() => props.space.files && props.space.files.length > 1);
const currentFile = computed(() => {
  if (!props.space.files || props.space.files.length === 0) return null;
  return props.space.files[currentIndex.value];
});

const handleDownloadAll = () => {
  downloadAll(props.space.files, props.space.name);
};

const nextImage = () => {
  if (currentIndex.value < props.space.files.length - 1) {
    currentIndex.value++;
  } else {
    currentIndex.value = 0;
  }
};

const prevImage = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  } else {
    currentIndex.value = props.space.files.length - 1;
  }
};

const formatPrice = (price) => {
  return Number(price).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
};

// Touch Handling
let touchStartX = 0;
let touchEndX = 0;

const handleTouchStart = (e) => {
  touchStartX = e.changedTouches[0].screenX;
};

const handleTouchEnd = (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
};

const handleSwipe = () => {
  const threshold = 50; // Minimum distance for swipe
  if (touchEndX < touchStartX - threshold) {
    nextImage(); // Swipe Left -> Next
  }
  if (touchEndX > touchStartX + threshold) {
    prevImage(); // Swipe Right -> Prev
  }
};
</script>
