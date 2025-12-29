<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="visible" 
        class="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
        @click.self="$emit('close')"
        @wheel.prevent="handleWheel"
      >
        <!-- Toolbar -->
        <div class="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/50 to-transparent">
          <div class="text-white/90 text-sm font-medium px-2">
            {{ currentIndex + 1 }} / {{ total }}
          </div>
          
          <div class="flex items-center gap-4">
            <!-- Download Button -->
            <a 
              v-if="currentFile" 
              :href="currentFile.url" 
              download
              class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors text-sm font-medium backdrop-blur-md"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              {{ t('gallery.download') }}
            </a>
            
            <!-- Close Button -->
            <button 
              @click="$emit('close')"
              class="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <button 
          v-if="currentIndex > 0" 
          @click="$emit('prev')"
          class="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>
        <button 
          v-if="currentIndex < total - 1" 
          @click="$emit('next')"
          class="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>

        <!-- Content -->
        <div 
          class="absolute inset-0 flex items-center justify-center p-4 sm:p-8 md:p-12 pb-20 pt-20" 
          @click.self="$emit('close')"
        >
          <!-- Image -->
          <img 
            v-if="currentFile?.type === 'image'" 
            :src="currentFile.url" 
            :alt="currentFile.name"
            class="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in duration-300"
          >

          <!-- PDF Viewer -->
          <div 
            v-else-if="currentFile?.type === 'pdf'"
            class="w-full h-full max-w-5xl bg-white rounded-lg overflow-hidden flex flex-col shadow-2xl"
          >
            <iframe :src="currentFile.url" class="flex-1 w-full border-none"></iframe>
          </div>

          <!-- Other Files -->
          <div v-else class="text-center text-white">
            <div class="w-24 h-24 mx-auto mb-6 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium mb-4">{{ currentFile?.name }}</h3>
            <p class="text-white/60 mb-6 text-sm">{{ t('gallery.previewNotSupported') }}</p>
          </div>
        </div>

        <!-- Hint -->
        <div class="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
          {{ t('gallery.scrollHint') }}
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  currentFile: {
    type: Object,
    default: null
  },
  currentIndex: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['close', 'prev', 'next']);

const { t } = useI18n();

const handleWheel = (e) => {
  if (e.deltaY > 0) {
    emit('next');
  } else if (e.deltaY < 0) {
    emit('prev');
  }
};

const handleKeydown = (e) => {
  if (!props.visible) return;
  
  switch (e.key) {
    case 'Escape':
      emit('close');
      break;
    case 'ArrowLeft':
      emit('prev');
      break;
    case 'ArrowRight':
      emit('next');
      break;
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>
