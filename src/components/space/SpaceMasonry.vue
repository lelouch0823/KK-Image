<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
    <!-- Header -->
    <div class="mb-8 flex items-end justify-between">
      <div>
        <h1 class="text-2xl font-bold text-primary">{{ space.name }}</h1>
        <p v-if="space.description" class="text-secondary mt-2">{{ space.description }}</p>
        
        <div class="flex items-center gap-4 mt-4 text-sm text-secondary">
           <span>{{ space.fileCount }} 个文件</span>
           <span>{{ space.viewCount }} 次访问</span>
        </div>
      </div>
      
      <button v-if="hasFiles" @click="handleDownloadAll" :disabled="downloading"
         class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
         <svg v-if="downloading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
             <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
             <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
         </svg>
         <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
         {{ downloading ? `打包中 ${downloadProgress}%` : '下载全部' }}
      </button>
    </div>

    <!-- Masonry Grid -->
    <div class="masonry-grid">
      <div v-for="(file, index) in space.files" :key="file.id" @click="openLightbox(index)"
        class="mb-4 break-inside-avoid rounded-xl overflow-hidden cursor-pointer group relative bg-gray-100 border border-gray-100 hover:border-gray-300 transition-all hover:shadow-lg">
        
        <!-- Image -->
        <img v-if="isImage(file)" :src="file.url" :alt="file.name"
          class="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy">
          
        <!-- Other Files -->
        <div v-else class="aspect-square w-full flex flex-col items-center justify-center bg-gray-50">
           <span class="text-xs font-bold text-gray-400 uppercase mb-2">{{ file.name.split('.').pop() }}</span>
           <span class="text-xs text-center text-gray-500 px-2 truncate w-full">{{ file.originalName || file.name }}</span>
        </div>

        <!-- Overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <span class="text-white text-xs font-medium truncate w-full">{{ file.name }}</span>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-if="space.files.length === 0" class="py-20 text-center text-secondary">
        <p>暂无内容</p>
    </div>

    <!-- Lightbox (Reusing same logic or component ideally, simplified here) -->
    <div v-if="lightbox.visible" class="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center" @click.self="lightbox.visible = false">
        <img v-if="lightbox.file && isImage(lightbox.file)" :src="lightbox.file.url" class="max-w-full max-h-full object-contain p-4">
        <button @click="lightbox.visible = false" class="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { isImage } from '@/utils/formatters';
import { useBatchDownload } from '@/composables/useBatchDownload';

const props = defineProps({
  space: { type: Object, required: true }
});

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
.masonry-grid {
  column-count: 2;
  column-gap: 1rem;
}

@media (min-width: 640px) {
  .masonry-grid { column-count: 3; }
}
@media (min-width: 1024px) {
  .masonry-grid { column-count: 4; }
}
@media (min-width: 1280px) {
  .masonry-grid { column-count: 5; }
}
</style>
