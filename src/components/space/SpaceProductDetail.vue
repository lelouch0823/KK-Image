<template>
  <div class="mx-auto w-full max-w-7xl px-4 py-8 pb-20 sm:px-6 lg:px-8">
    <div class="flex w-full flex-col gap-8 lg:flex-row lg:gap-12">
      <!-- Left: Media Gallery -->
      <div class="w-full space-y-4 lg:w-2/3">
        <!-- Main Image -->
        <div
          class="group relative aspect-video touch-pan-y overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-muted) shadow-sm"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
        >
          <AppImage
            v-if="currentFile && isImage(currentFile)"
            :src="currentFile.url"
            :alt="currentFile.name"
            :blurhash="currentFile.blurhash"
            fit="contain"
            class="bg-surface size-full select-none"
            rounded="none"
          />
          <div
            v-else-if="currentFile && isPdf(currentFile) && !showPdfPreview"
            class="flex size-full flex-col items-center justify-center gap-6 bg-(--bg-muted) p-8 text-center"
          >
            <!-- PDF Icon -->
            <div
              class="flex size-24 items-center justify-center rounded-2xl bg-(--bg-card) shadow-sm"
            >
              <AppIcon name="document-text" class="size-12 text-(--color-danger-text)" />
            </div>

            <!-- File Info -->
            <div>
              <h3 class="font-medium text-(--text-main)">{{ currentFile.name }}</h3>
              <p class="mt-1 text-sm text-(--text-secondary)">
                PDF • {{ formatSize(currentFile.size) }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap justify-center gap-3">
              <AppButton
                variant="white"
                size="sm"
                class="text-(--text-main)"
                @click.stop="showPdfPreview = true"
              >
                <template #icon-left>
                  <AppIcon name="eye" class="size-4" />
                </template>
                {{ t('spacePublic.viewInline') }}
              </AppButton>

              <a
                :href="currentFile.url"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 rounded-lg border border-(--border-color) bg-(--bg-card) px-4 py-2 text-sm font-medium text-(--text-main) transition-colors hover:bg-(--bg-surface-hover)"
                @click.stop
              >
                <AppIcon name="arrow-top-right-on-square" class="size-4" />
                {{ t('spacePublic.openPreview') }}
              </a>

              <a
                :href="currentFile.url"
                download
                class="bg-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-(--text-inverse) transition-colors hover:bg-(--color-primary-hover)"
                @click.stop
              >
                <AppIcon name="arrow-down-tray" class="size-4" />
                {{ t('spacePublic.download') }}
              </a>
            </div>
          </div>

          <!-- Inline PDF Preview (Iframe) -->
          <div
            v-else-if="currentFile && isPdf(currentFile) && showPdfPreview"
            class="relative flex size-full flex-col bg-(--bg-card)"
          >
            <iframe :src="currentFile.url" class="size-full border-0" title="PDF Preview"></iframe>
            <AppButton
              variant="ghost"
              size="sm"
              class="absolute top-4 right-4 bg-(--color-overlay-dim) text-(--text-inverse) backdrop-blur-sm hover:!bg-(--color-overlay-dim) hover:!text-(--text-inverse)"
              @click="showPdfPreview = false"
            >
              {{ t('spacePublic.backToCard') }}
            </AppButton>
          </div>

          <!-- Generic File Preview -->
          <div
            v-else-if="currentFile"
            class="text-secondary flex size-full flex-col items-center justify-center gap-4 bg-(--bg-muted) p-8 text-center"
          >
            <div
              class="flex size-20 items-center justify-center rounded-2xl bg-(--bg-card) shadow-sm"
            >
              <AppIcon name="document-text" class="text-primary size-10" />
            </div>
            <div>
              <h3 class="font-medium text-(--text-main)">{{ currentFile.name }}</h3>
              <p class="mt-1 text-sm text-(--text-secondary)">
                {{ formatSize(currentFile.size) }}
              </p>
            </div>
            <a
              :href="currentFile.url"
              download
              class="hover:bg-primary-hover hover:text-(--text-inverse) mt-2 inline-flex items-center gap-2 rounded-lg border border-(--border-color) bg-(--bg-card) px-4 py-2 text-sm font-medium text-(--text-main) transition-colors"
              @click.stop
            >
              <AppIcon name="arrow-down-tray" class="size-4" />
              {{ t('spacePublic.download') }}
            </a>
          </div>

          <!-- No Media State -->
          <div
            v-else
            class="flex size-full flex-col items-center justify-center gap-4 bg-(--bg-muted) p-8 text-center text-(--text-secondary)"
          >
            <div
              class="flex size-16 items-center justify-center rounded-2xl bg-(--bg-card) shadow-sm"
            >
              <AppIcon name="photo" class="size-8 text-(--text-muted) opacity-50" />
            </div>
            <p class="text-sm font-medium">{{ t('gallery.noImages') }}</p>
          </div>

          <!-- Navigation Arrows (Hidden on mobile) -->
          <AppButton
            v-if="hasMultipleFiles"
            variant="white"
            size="sm"
            class="bg-surface/80 text-secondary-text absolute top-1/2 left-4 hidden -translate-y-1/2 rounded-full opacity-0 shadow-md transition-opacity group-hover:opacity-100 lg:!flex"
            @click="prevImage"
          >
            <AppIcon name="chevron-left" class="size-5" />
          </AppButton>
          <AppButton
            v-if="hasMultipleFiles"
            variant="white"
            size="sm"
            class="absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-full bg-(--bg-card)/80 text-(--text-secondary) opacity-0 shadow-md transition-opacity group-hover:opacity-100 lg:!flex"
            @click="nextImage"
          >
            <AppIcon name="chevron-right" class="size-5" />
          </AppButton>

          <!-- Mobile Indicators -->
          <div
            v-if="hasMultipleFiles"
            class="pointer-events-none absolute right-0 bottom-3 left-0 flex justify-center gap-1.5 lg:hidden"
          >
            <span
              v-for="(file, idx) in displayFiles"
              :key="file.id"
              class="size-1.5 rounded-full transition-all"
              :class="currentIndex === idx ? 'w-3 bg-(--text-inverse)' : 'bg-(--text-inverse)/50'"
            ></span>
          </div>
        </div>

        <!-- Thumbnails -->
        <div v-if="hasMultipleFiles" class="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
          <AppButton
            v-for="(file, index) in displayFiles"
            :key="file.id"
            variant="ghost"
            size="sm"
            class="relative !h-20 !w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 !p-0 transition-all hover:opacity-80 active:scale-95 [&_span]:contents"
            :class="
              currentIndex === index
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-transparent'
            "
            @click="
              currentIndex = index;
              showPdfPreview = false;
            "
          >
            <AppImage
              v-if="isImage(file)"
              :src="file.url"
              :alt="file.name"
              :blurhash="file.blurhash"
              fit="cover"
              class="size-full"
              rounded="none"
            />
            <div
              v-else
              class="bg-surface-muted text-secondary-text flex size-full flex-col items-center justify-center gap-1 text-xs font-bold uppercase"
            >
              <template v-if="isPdf(file)">
                <AppIcon name="document-text" class="size-6 text-(--color-danger-text)" />
                <span class="text-[10px]">PDF</span>
              </template>
              <span v-else>{{ file.name.split('.').pop() }}</span>
            </div>
          </AppButton>
        </div>
      </div>

      <!-- Right: Product Info -->
      <div class="w-full space-y-6 lg:w-1/3 xl:space-y-8">
        <div>
          <div
            v-if="templateData.brand"
            class="mb-3 inline-flex items-center rounded-full border border-(--border-color) bg-(--bg-card) px-3 py-1 text-xs font-medium whitespace-nowrap text-(--text-main) shadow-sm"
          >
            {{ templateData.brand }}
          </div>
          <h1
            class="text-2xl leading-tight font-semibold tracking-tight text-(--text-main) sm:text-3xl"
          >
            {{ space.name }}
          </h1>
          <p v-if="templateData.series" class="mt-2 text-base text-(--text-secondary) sm:text-lg">
            {{ templateData.series }}
          </p>
          <p v-if="templateData.sku" class="mt-3 font-mono text-xs font-medium text-(--text-muted)">
            SKU: {{ templateData.sku }}
          </p>
        </div>

        <div
          v-if="templateData.price && Number(templateData.price) > 0"
          class="flex items-baseline gap-1"
        >
          <span class="text-sm font-medium text-(--text-secondary)">¥</span>
          <span class="text-3xl font-bold tracking-tight text-(--text-main)">{{
            formatPrice(templateData.price)
          }}</span>
        </div>
        <div
          v-else-if="templateData.price"
          class="text-primary flex items-center gap-3 rounded-xl border border-primary/20 bg-(--color-primary-bg) p-4"
        >
          <div
            class="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-(--color-primary-bg)"
          >
            <AppIcon name="chat-bubble-left-right" class="size-5" />
          </div>
          <span class="text-sm font-semibold tracking-wide">{{
            t('spacePublic.inquiryPrice') || 'Contact for Price'
          }}</span>
        </div>

        <!-- SOTA Product Parameters Table -->
        <div
          v-if="hasAnySpecs"
          class="overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card)"
        >
          <dl class="divide-y divide-(--border-color) text-sm">
            <div
              v-if="templateData.brand"
              class="flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-[100px_1fr] sm:gap-4 sm:px-5"
            >
              <dt class="font-medium text-(--text-secondary)">{{ t('spaceManager.brand') }}</dt>
              <dd class="font-semibold text-(--text-main)">{{ templateData.brand }}</dd>
            </div>
            <div
              v-if="templateData.series"
              class="flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-[100px_1fr] sm:gap-4 sm:px-5"
            >
              <dt class="font-medium text-(--text-secondary)">{{ t('spaceManager.series') }}</dt>
              <dd class="font-semibold text-(--text-main)">{{ templateData.series }}</dd>
            </div>
            <div
              v-if="templateData.material"
              class="flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-[100px_1fr] sm:gap-4 sm:px-5"
            >
              <dt class="font-medium text-(--text-secondary)">{{ t('spaceManager.material') }}</dt>
              <dd class="font-semibold text-(--text-main)">{{ templateData.material }}</dd>
            </div>
            <div
              v-if="templateData.sku"
              class="flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-[100px_1fr] sm:gap-4 sm:px-5"
            >
              <dt class="font-medium text-(--text-secondary)">SKU</dt>
              <dd class="font-semibold break-all text-(--text-main)">{{ templateData.sku }}</dd>
            </div>
          </dl>
        </div>

        <div
          v-if="space.description"
          class="prose prose-sm prose-gray dark:prose-invert text-secondary-text max-w-none border-t border-(--border-color) pt-6"
        >
          <h3 class="text-main text-sm font-medium">{{ t('spacePublic.description') }}</h3>
          <p class="whitespace-pre-line">{{ space.description }}</p>
        </div>

        <div class="hidden space-y-3 border-t border-(--border-color) pt-6 lg:block">
          <a
            v-if="currentFile"
            :href="currentFile.url"
            download
            class="bg-primary shadow-primary/10 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-(--text-inverse) shadow-lg transition-all hover:-translate-y-[1px] hover:bg-(--color-primary-hover) active:translate-y-0"
          >
            <AppIcon name="arrow-down-tray" class="size-5" />
            {{ t('spacePublic.downloadCurrent') }}
          </a>

          <AppButton
            v-if="hasMultipleFiles"
            :disabled="downloading"
            variant="white"
            class="text-primary w-full hover:-translate-y-[1px] hover:bg-(--bg-surface-hover) hover:shadow-sm active:translate-y-0 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            @click="handleDownloadAll"
          >
            <template #icon-left>
              <AppIcon v-if="downloading" name="spinner" class="size-5 animate-spin" />
              <AppIcon v-else name="arrow-down-tray" class="size-5" />
            </template>
            {{
              downloading
                ? `${t('spacePublic.packing')} ${downloadProgress}%`
                : t('spacePublic.downloadAll')
            }}
          </AppButton>

          <p class="mt-3 text-center text-xs text-(--text-muted)">
            <span>{{ space.viewCount || 0 }} {{ t('spacePublic.views') }}</span>
            <span v-if="space.downloadCount !== undefined">
              • {{ space.downloadCount }} {{ t('spacePublic.downloads') }}</span
            >
          </p>
        </div>
      </div>
    </div>

    <!-- SOTA Mobile Sticky Bottom Bar -->
    <div
      v-if="currentFile"
      class="fixed right-0 bottom-0 left-0 z-50 flex items-center gap-3 border-t border-(--border-color) bg-(--bg-card) p-4 pb-[env(safe-area-inset-bottom,20px)] shadow-lg transition-transform duration-300 ease-in-out lg:hidden"
      :class="isScrolling ? 'translate-y-full' : 'translate-y-0'"
    >
      <div class="flex flex-1 items-center gap-2">
        <div
          v-if="templateData.price && Number(templateData.price) > 0"
          class="mr-auto flex flex-col justify-center px-1"
        >
          <span class="text-[10px] leading-none text-(--text-secondary)">{{
            t('spaceManager.price')
          }}</span>
          <div class="mt-0.5 flex items-baseline gap-0.5">
            <span class="text-primary text-[10px]">¥</span>
            <span class="text-primary text-lg leading-none font-bold tracking-tight">{{
              formatPrice(templateData.price).split('.')[0]
            }}</span>
            <span class="text-primary text-[10px] font-medium opacity-80"
              >.{{ formatPrice(templateData.price).split('.')[1] }}</span
            >
          </div>
        </div>

        <a
          v-if="currentFile"
          :href="currentFile.url"
          download
          class="text-primary flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-(--color-primary-bg) py-3 font-medium transition-transform active:scale-95"
        >
          <AppIcon name="arrow-down-tray" class="size-5" />
          <span class="text-sm font-semibold">{{ t('spacePublic.download') }}</span>
        </a>

        <AppButton
          v-if="hasMultipleFiles || (displayFiles.length > 0 && isDesktop)"
          :disabled="downloading"
          variant="primary"
          block
          class="shadow-primary/10 flex-1 shadow-lg transition-transform active:scale-95 disabled:scale-100"
          @click="handleDownloadAll"
        >
          <template #icon-left>
            <AppIcon v-if="downloading" name="spinner" class="size-5 animate-spin" />
            <AppIcon v-else name="arrow-down-tray" class="size-5" />
          </template>
          <span class="text-sm text-nowrap">{{
            downloading ? `${downloadProgress}%` : t('spacePublic.downloadAll')
          }}</span>
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { isImage, isPdf, formatSize } from '@/utils/formatters';
import { useBatchDownload } from '@/composables/useBatchDownload';
import { useI18n } from '@/composables/useI18n';
import { useResponsive } from '@/composables/useResponsive';
import AppButton from '@/components/ui/AppButton.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  space: { type: Object, required: true },
});

const showPdfPreview = ref(false);

const { t } = useI18n();
const { downloading, downloadProgress, downloadAll } = useBatchDownload();
const { isDesktop } = useResponsive();

const templateData = computed(() => props.space.templateData || {});

const hasAnySpecs = computed(() => {
  return !!(
    templateData.value.brand ||
    templateData.value.series ||
    templateData.value.material ||
    templateData.value.sku
  );
});

const resolveTemplateImageUrl = (value) => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (
    url.startsWith('/') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }
  return `/file/${url}`;
};

const displayFiles = computed(() => {
  const media = [];
  const seenUrls = new Set();
  const pushMedia = (file) => {
    if (!file?.url || seenUrls.has(file.url)) return;
    seenUrls.add(file.url);
    media.push(file);
  };
  if (templateData.value.images && Array.isArray(templateData.value.images)) {
    templateData.value.images.forEach((img, idx) => {
      const url = resolveTemplateImageUrl(img);
      if (!url) return;
      pushMedia({
        id: `p-img-${idx}`,
        url,
        name: String(img).split('/').pop() || String(img),
        size: 0,
        mimeType: 'image/jpeg',
      });
    });
  }
  if (props.space.files && Array.isArray(props.space.files)) {
    props.space.files.forEach((file) => pushMedia(file));
  }
  return media;
});

// 初始化索引：优先定位到封面图，否则默认第一张
const getCoverIndex = () => {
  if (props.space.coverFileId) {
    const idx = displayFiles.value.findIndex((f) => f.id === props.space.coverFileId);
    return idx >= 0 ? idx : 0;
  }
  return 0;
};
const currentIndex = ref(getCoverIndex());

watch(
  () => [props.space?.id, props.space?.coverFileId, displayFiles.value.length],
  () => {
    currentIndex.value = getCoverIndex();
    showPdfPreview.value = false;
  }
);

const hasMultipleFiles = computed(() => displayFiles.value.length > 1);
const currentFile = computed(() => {
  if (displayFiles.value.length === 0) return null;
  return displayFiles.value[currentIndex.value] || displayFiles.value[0];
});

const handleDownloadAll = () => {
  downloadAll(displayFiles.value, props.space.name);
};

const nextImage = () => {
  showPdfPreview.value = false;
  if (currentIndex.value < displayFiles.value.length - 1) {
    currentIndex.value++;
  } else {
    currentIndex.value = 0;
  }
};

const prevImage = () => {
  showPdfPreview.value = false;
  if (currentIndex.value > 0) {
    currentIndex.value--;
  } else {
    currentIndex.value = displayFiles.value.length - 1;
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

// Smart Scroll Hide for Mobile Bar
const isScrolling = ref(false);
let scrollTimeout = null;

const handleScroll = () => {
  isScrolling.value = true;
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  scrollTimeout = setTimeout(() => {
    isScrolling.value = false;
  }, 1000);
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
});
</script>
