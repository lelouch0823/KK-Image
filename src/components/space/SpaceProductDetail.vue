<template>
  <div class="mx-auto w-full max-w-7xl px-4 py-8 pb-20 sm:px-6 lg:px-8">
    <div class="flex w-full flex-col gap-8 lg:flex-row lg:gap-12">
      <!-- Left: Media Gallery -->
      <div class="w-full space-y-4 lg:w-2/3">
        <!-- Main Image -->
        <div
          class="group relative aspect-video touch-pan-y overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-muted)] shadow-sm"
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
            <div
              v-else-if="currentFile && isPdf(currentFile) && !showPdfPreview"
              class="flex size-full flex-col items-center justify-center gap-6 bg-[var(--bg-muted)] p-8 text-center"
            >
              <!-- PDF Icon -->
              <div class="flex size-24 items-center justify-center rounded-2xl bg-[var(--bg-card)] shadow-sm">
                <svg class="size-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <!-- File Info -->
              <div>
                <h3 class="font-medium text-[var(--text-main)]">{{ currentFile.name }}</h3>
                <p class="mt-1 text-sm text-[var(--text-secondary)]">PDF • {{ formatSize(currentFile.size) }}</p>
              </div>

              <!-- Actions -->
              <div class="flex flex-wrap justify-center gap-3">
                <button
                  class="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface-hover)]"
                  @click.stop="showPdfPreview = true"
                >
                  <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  {{ t('spacePublic.viewInline') }}
                </button>

                <a
                  :href="currentFile.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface-hover)]"
                  @click.stop
                >
                  <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  {{ t('spacePublic.openPreview') }}
                </a>

                <a
                  :href="currentFile.url"
                  download
                  class="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] transition-colors hover:bg-[var(--color-primary-hover)]"
                  @click.stop
                >
                  <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {{ t('spacePublic.download') }}
                </a>
              </div>
            </div>

            <!-- Inline PDF Preview (Iframe) -->
            <div
              v-else-if="currentFile && isPdf(currentFile) && showPdfPreview"
              class="relative flex size-full flex-col bg-[var(--bg-card)]"
            >
              <iframe
                :src="currentFile.url"
                class="size-full border-0"
                title="PDF Preview"
              ></iframe>
              <button
                class="absolute top-4 right-4 rounded-lg bg-black/50 px-3 py-1 text-sm text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                @click="showPdfPreview = false"
              >
                {{ t('spacePublic.backToCard') }}
              </button>
            </div>

            <!-- Generic File Preview -->
            <div
              v-else-if="currentFile"
              class="text-secondary flex size-full flex-col items-center justify-center gap-4 bg-[var(--bg-muted)] p-8 text-center"
            >
              <div class="flex size-20 items-center justify-center rounded-2xl bg-[var(--bg-card)] shadow-sm">
                <svg class="size-10 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 class="font-medium text-[var(--text-main)]">{{ currentFile.name }}</h3>
                <p class="mt-1 text-sm text-[var(--text-secondary)]">
                  {{ formatSize(currentFile.size) }}
                </p>
              </div>
              <a
                :href="currentFile.url"
                download
                class="hover:bg-primary-hover hover:text-[var(--text-inverse)] mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition-colors"
                @click.stop
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {{ t('spacePublic.download') }}
              </a>
            </div>

            <!-- No Media State -->
            <div
              v-else
              class="flex size-full flex-col items-center justify-center gap-4 bg-[var(--bg-muted)] p-8 text-center text-[var(--text-secondary)]"
            >
               <div class="flex size-16 items-center justify-center rounded-2xl bg-[var(--bg-card)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                 <svg class="size-8 text-[var(--text-muted)] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                 </svg>
               </div>
               <p class="text-sm font-medium">{{ t('gallery.noImages') }}</p>
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
              v-for="(file, idx) in displayFiles"
              :key="file.id"
              class="size-1.5 rounded-full transition-all"
              :class="currentIndex === idx ? 'w-3 bg-white' : 'bg-white/50'"
            ></span>
          </div>
        </div>

        <!-- Thumbnails -->
        <div v-if="hasMultipleFiles" class="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
          <button
            v-for="(file, index) in displayFiles"
            :key="file.id"
            class="relative size-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all hover:opacity-80 active:scale-95"
            :class="
              currentIndex === index
                ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-light,rgba(59,130,246,0.2))]'
                : 'border-transparent'
            "
            @click="currentIndex = index; showPdfPreview = false;"
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
              class="bg-surface-muted text-secondary-text flex size-full flex-col items-center justify-center gap-1 text-xs font-bold uppercase"
            >
              <template v-if="isPdf(file)">
                <svg class="size-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span class="text-[10px]">PDF</span>
              </template>
              <span v-else>{{ file.name.split('.').pop() }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Right: Product Info -->
      <div class="w-full space-y-6 lg:w-1/3 xl:space-y-8">
        <div>
          <div
            v-if="templateData.brand"
            class="mb-3 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1 text-xs font-medium whitespace-nowrap text-[var(--text-main)] shadow-sm"
          >
            {{ templateData.brand }}
          </div>
          <h1 class="text-2xl leading-tight font-semibold tracking-tight text-[var(--text-main)] sm:text-3xl">{{ space.name }}</h1>
          <p v-if="templateData.series" class="mt-2 text-base text-[var(--text-secondary)] sm:text-lg">
            {{ templateData.series }}
          </p>
          <p v-if="templateData.sku" class="mt-3 font-mono text-xs font-medium text-[var(--text-muted)]">
            SKU: {{ templateData.sku }}
          </p>
        </div>

        <div v-if="templateData.price && Number(templateData.price) > 0" class="flex items-baseline gap-1">
          <span class="text-sm font-medium text-[var(--text-secondary)]">¥</span>
          <span class="text-3xl font-bold tracking-tight text-[var(--text-main)]">{{ formatPrice(templateData.price) }}</span>
        </div>
        <div v-else-if="templateData.price" class="flex items-center gap-3 rounded-xl border border-[var(--color-primary-light,rgba(59,130,246,0.1))] bg-[var(--color-primary-light,rgba(59,130,246,0.05))] p-4 text-[var(--color-primary)]">
           <div class="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light,rgba(59,130,246,0.15))]">
             <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
             </svg>
           </div>
           <span class="text-sm font-semibold tracking-wide">{{ t('spacePublic.inquiryPrice') || 'Contact for Price' }}</span>
        </div>

        <!-- SOTA Product Parameters Table -->
        <div v-if="hasAnySpecs" class="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
          <dl class="divide-y divide-[var(--border-color)] text-sm">
            <div
              v-if="templateData.brand"
              class="flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-[100px_1fr] sm:gap-4 sm:px-5"
            >
              <dt class="font-medium text-[var(--text-secondary)]">{{ t('spaceManager.brand') }}</dt>
              <dd class="font-semibold text-[var(--text-main)]">{{ templateData.brand }}</dd>
            </div>
            <div
              v-if="templateData.series"
              class="flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-[100px_1fr] sm:gap-4 sm:px-5"
            >
              <dt class="font-medium text-[var(--text-secondary)]">{{ t('spaceManager.series') }}</dt>
              <dd class="font-semibold text-[var(--text-main)]">{{ templateData.series }}</dd>
            </div>
            <div
              v-if="templateData.material"
              class="flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-[100px_1fr] sm:gap-4 sm:px-5"
            >
              <dt class="font-medium text-[var(--text-secondary)]">{{ t('spaceManager.material') }}</dt>
              <dd class="font-semibold text-[var(--text-main)]">{{ templateData.material }}</dd>
            </div>
            <div
              v-if="templateData.sku"
              class="flex flex-col gap-1 px-4 py-3 sm:grid sm:grid-cols-[100px_1fr] sm:gap-4 sm:px-5"
            >
              <dt class="font-medium text-[var(--text-secondary)]">SKU</dt>
              <dd class="font-semibold break-all text-[var(--text-main)]">{{ templateData.sku }}</dd>
            </div>
          </dl>
        </div>

        <div v-if="space.description" class="prose prose-sm prose-gray dark:prose-invert text-secondary-text max-w-none border-t border-[var(--border-color)] pt-6">
          <h3 class="text-main text-sm font-medium">{{ t('spacePublic.description') }}</h3>
          <p class="whitespace-pre-line">{{ space.description }}</p>
        </div>

        <div class="hidden space-y-3 border-t border-[var(--border-color)] pt-6 lg:block">
          <a
            v-if="currentFile"
            :href="currentFile.url"
            download
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3 font-medium text-[var(--text-inverse)] shadow-[var(--color-primary-light,rgba(59,130,246,0.2))] shadow-lg transition-all hover:-translate-y-[1px] hover:bg-[var(--color-primary-hover)] active:translate-y-0"
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
            class="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-3 font-medium text-[var(--color-primary)] transition-all hover:-translate-y-[1px] hover:bg-[var(--bg-surface-hover)] hover:shadow-sm active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
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

          <p class="mt-3 text-center text-xs text-[var(--text-muted)]">
            <span>{{ space.viewCount || 0 }} {{ t('spacePublic.views') }}</span>
            <span v-if="space.downloadCount !== undefined"> • {{ space.downloadCount }} {{ t('spacePublic.downloads') }}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- SOTA Mobile Sticky Bottom Bar -->
    <div
      v-if="currentFile"
      class="fixed right-0 bottom-0 left-0 z-50 flex items-center gap-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] p-4 pb-[env(safe-area-inset-bottom,20px)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:hidden"
    >
      <div class="flex flex-1 items-center gap-2">
        <div v-if="templateData.price && Number(templateData.price) > 0" class="mr-auto flex flex-col justify-center px-1">
           <span class="text-[10px] leading-none text-[var(--text-secondary)]">{{ t('spaceManager.price') }}</span>
           <div class="mt-0.5 flex items-baseline gap-0.5">
             <span class="text-[10px] text-[var(--color-primary)]">¥</span>
             <span class="text-lg leading-none font-bold tracking-tight text-[var(--color-primary)]">{{ formatPrice(templateData.price).split('.')[0] }}</span>
             <span class="text-[10px] font-medium text-[var(--color-primary)] opacity-80">.{{ formatPrice(templateData.price).split('.')[1] }}</span>
           </div>
        </div>
        
        <a
          v-if="currentFile"
          :href="currentFile.url"
          download
          class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-primary-light,rgba(59,130,246,0.2))] bg-[var(--color-primary-light,rgba(59,130,246,0.05))] py-3 font-medium text-[var(--color-primary)] transition-transform active:scale-95"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            ></path>
          </svg>
          <span class="text-sm font-semibold">{{ t('spacePublic.download') }}</span>
        </a>

        <button
          v-if="hasMultipleFiles || (displayFiles.length > 0 && isDesktop)"
          :disabled="downloading"
          class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3 font-medium text-[var(--text-inverse)] shadow-[var(--color-primary-light,rgba(59,130,246,0.2))] shadow-lg transition-transform active:scale-95 disabled:scale-100 disabled:opacity-50"
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
import { isImage, isPdf, formatSize } from '@/utils/formatters';
import { useBatchDownload } from '@/composables/useBatchDownload';
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';

const props = defineProps({
  space: { type: Object, required: true },
});

const showPdfPreview = ref(false);

const { t } = useI18n();
const { downloading, downloadProgress, downloadAll } = useBatchDownload();

const templateData = computed(() => props.space.templateData || {});

const hasAnySpecs = computed(() => {
  return !!(
    templateData.value.brand ||
    templateData.value.series ||
    templateData.value.material ||
    templateData.value.sku
  );
});

const displayFiles = computed(() => {
  const media = [];
  if (templateData.value.images && Array.isArray(templateData.value.images)) {
    templateData.value.images.forEach((img, idx) => {
      media.push({
        id: `p-img-${idx}`,
        url: `/file/${img}`,
        name: img.split('/').pop() || img,
        size: 0,
        mimeType: 'image/jpeg',
      });
    });
  }
  if (props.space.files && Array.isArray(props.space.files)) {
    media.push(...props.space.files);
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
</script>
