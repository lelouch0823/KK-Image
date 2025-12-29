<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      <div class="flex flex-col lg:flex-row gap-8 lg:gap-12">
          <!-- Left: Media Gallery -->
          <div class="w-full lg:w-2/3 space-y-4">
              <!-- Main Image -->
              <div class="aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative group touch-pan-y"
                   @touchstart="handleTouchStart"
                   @touchend="handleTouchEnd">
                  <img v-if="currentFile && isImage(currentFile)" :src="currentFile.url" 
                      class="w-full h-full object-contain bg-white select-none" alt="Product Image">
                   <div v-else class="w-full h-full flex items-center justify-center text-secondary">
                       {{ t('spacePublic.noPreview') }}
                   </div>
                   
                   <!-- Navigation Arrows (Hidden on mobile) -->
                   <button v-if="hasMultipleFiles" @click="prevImage" 
                       class="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                       <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                   </button>
                   <button v-if="hasMultipleFiles" @click="nextImage"
                       class="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                       <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                   </button>

                   <!-- Mobile Indicators -->
                   <div v-if="hasMultipleFiles" class="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 lg:hidden pointer-events-none">
                     <span v-for="(file, idx) in space.files" :key="file.id" 
                           class="w-1.5 h-1.5 rounded-full transition-all"
                           :class="currentIndex === idx ? 'bg-white w-3' : 'bg-white/50'"></span>
                   </div>
              </div>

              <!-- Thumbnails -->
              <div v-if="hasMultipleFiles" class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  <button v-for="(file, index) in space.files" :key="file.id"
                      @click="currentIndex = index"
                      class="relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0"
                      :class="currentIndex === index ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'">
                      <img v-if="isImage(file)" :src="file.url" class="w-full h-full object-cover">
                      <div v-else class="w-full h-full bg-gray-50 flex items-center justify-center text-xs text-gray-400 font-bold uppercase">
                          {{ file.name.split('.').pop() }}
                      </div>
                  </button>
              </div>
          </div>

          <!-- Right: Product Info -->
          <div class="w-full lg:w-1/3 space-y-8">
              <div>
                  <div v-if="templateData.brand" class="text-sm font-medium text-primary mb-2 bg-gray-100 inline-block px-2 py-1 rounded">
                      {{ templateData.brand }}
                  </div>
                  <h1 class="text-3xl font-bold text-gray-900 leading-tight">{{ space.name }}</h1>
                  <p v-if="templateData.series" class="text-lg text-secondary mt-1">{{ templateData.series }}</p>
                  <p v-if="templateData.sku" class="text-xs text-gray-400 mt-2 font-mono">SKU: {{ templateData.sku }}</p>
              </div>

              <div v-if="templateData.price" class="flex items-baseline gap-1">
                  <span class="text-sm text-gray-500">¥</span>
                  <span class="text-3xl font-bold text-gray-900">{{ formatPrice(templateData.price) }}</span>
              </div>

              <div class="space-y-4 pt-6 border-t border-gray-100">
                  <div v-if="space.description">
                      <h3 class="text-sm font-medium text-gray-900 mb-2">{{ t('spacePublic.description') }}</h3>
                      <p class="text-secondary leading-relaxed text-sm">{{ space.description }}</p>
                  </div>
                  
                  <div v-if="templateData.material">
                      <h3 class="text-sm font-medium text-gray-900 mb-2">{{ t('spacePublic.material') }}</h3>
                      <p class="text-secondary text-sm">{{ templateData.material }}</p>
                  </div>
              </div>

              <div class="hidden lg:block pt-6 border-t border-gray-100 space-y-3">
                  <a v-if="currentFile" :href="currentFile.url" download
                      class="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-gray-800 transition-colors shadow-lg shadow-primary/20">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                      </svg>
                      {{ t('spacePublic.downloadCurrent') }}
                  </a>

                  <button v-if="hasMultipleFiles" @click="handleDownloadAll" :disabled="downloading"
                      class="flex items-center justify-center gap-2 w-full py-3 bg-white border border-gray-200 text-primary font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <svg v-if="downloading" class="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      {{ downloading ? `${t('spacePublic.packing')} ${downloadProgress}%` : t('spacePublic.downloadAll') }}
                  </button>

                  <p class="text-center text-xs text-gray-400 mt-3">
                      {{ space.viewCount }} {{ t('spacePublic.views') }} • {{ space.downloadCount }} {{ t('spacePublic.downloads') }}
                  </p>
              </div>
          </div>
      </div>

      <!-- SOTA Mobile Sticky Bottom Bar -->
      <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-[env(safe-area-inset-bottom,20px)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:hidden z-50 flex items-center gap-3">
          <div class="flex-1 flex gap-2">
            <a v-if="currentFile" :href="currentFile.url" download
               class="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-primary font-medium rounded-xl active:scale-95 transition-transform">
               <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
               </svg>
               <span class="text-sm">{{ t('spacePublic.download') }}</span>
            </a>

            <button v-if="hasMultipleFiles" @click="handleDownloadAll" :disabled="downloading"
               class="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white font-medium rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100">
               <svg v-if="downloading" class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                   <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                   <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
               <span class="text-sm text-nowrap">{{ downloading ? `${downloadProgress}%` : t('spacePublic.downloadAll') }}</span>
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

const props = defineProps({
  space: { type: Object, required: true }
});

const { addToast } = useToast();
const { t } = useI18n();
const { downloading, downloadProgress, downloadAll } = useBatchDownload();

const templateData = computed(() => props.space.templateData || {});

// 初始化索引：优先定位到封面图，否则默认第一张
const getCoverIndex = () => {
    if (props.space.coverFileId && props.space.files) {
        const idx = props.space.files.findIndex(f => f.id === props.space.coverFileId);
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
