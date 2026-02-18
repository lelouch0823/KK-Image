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
        class="fixed inset-0 z-50 bg-black/95 backdrop-blur-md"
        @click.self="$emit('close')"
        @wheel="handleWheel"
      >
        <!-- Toolbar -->
        <div
          class="absolute top-0 right-0 left-0 z-50 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-4 transition-colors"
        >
          <div class="px-2 text-sm font-medium text-white/90">
            {{ currentIndex + 1 }} / {{ total }}
          </div>

          <div class="flex items-center gap-4">
            <!-- Zoom/Rotate Toolbar (Only for images) -->
            <div v-if="currentFile?.type === 'image'" class="mr-4 flex items-center gap-2 border-r border-white/10 pr-4">
              <!-- Rotate -->
              <button
                type="button"
                class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Rotate image (R)"
                title="Rotate (R)"
                @click.stop="rotate"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  ></path>
                </svg>
              </button>

              <!-- Zoom In -->
              <button
                type="button"
                class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Zoom in (+)"
                title="Zoom In (+)"
                @click.stop="zoomIn"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                  ></path>
                </svg>
              </button>

              <!-- Zoom Out -->
              <button
                type="button"
                class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Zoom out (-)"
                title="Zoom Out (-)"
                @click.stop="zoomOut"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                  ></path>
                </svg>
              </button>

              <!-- Zoom indicator -->
              <span class="min-w-12 text-center text-sm font-medium text-white/70">
                {{ Math.round(scale * 100) }}%
              </span>
            </div>

            <!-- Download Button -->
            <a
              v-if="currentFile"
              :href="currentFile.url"
              download
              class="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Download file"
            >
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                ></path>
              </svg>
              {{ t('gallery.download') }}
            </a>

            <!-- Close Button -->
            <button
              class="flex size-10 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close"
              @click="$emit('close')"
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

        <!-- Navigation Buttons -->
        <button
          v-if="currentIndex > 0"
          class="absolute top-1/2 left-4 z-50 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Previous image"
          @click="$emit('prev')"
        >
          <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            ></path>
          </svg>
        </button>
        <button
          v-if="currentIndex < total - 1"
          class="absolute top-1/2 right-4 z-50 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Next image"
          @click="$emit('next')"
        >
          <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            ></path>
          </svg>
        </button>

        <!-- Content -->
        <div
          class="absolute inset-0 flex items-center justify-center overflow-hidden p-4 py-20 sm:p-8 md:p-12"
          @click.self="$emit('close')"
        >
          <!-- Image -->
          <img
            v-if="currentFile?.type === 'image'"
            :src="currentFile.url"
            :alt="currentFile.name"
            class="max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-transform duration-200"
            :class="{ 'cursor-zoom-in': scale === 1, 'cursor-grab': scale > 1 }"
            :style="{ transform: `scale(${scale}) rotate(${rotation}deg)` }"
          />

          <!-- PDF Viewer -->
          <div
            v-else-if="currentFile?.type === 'pdf'"
            class="flex size-full max-w-5xl flex-col overflow-hidden rounded-lg bg-[var(--bg-card)] shadow-2xl"
          >
            <iframe :src="currentFile.url" class="w-full flex-1 border-none"></iframe>
          </div>

          <!-- Other Files -->
          <div v-else class="text-center text-white">
            <div
              class="mx-auto mb-6 flex size-24 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md"
            >
              <svg class="size-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                ></path>
              </svg>
            </div>
            <h3 class="mb-4 text-lg font-medium">{{ currentFile?.name }}</h3>
            <p class="mb-6 text-sm text-white/60">{{ t('gallery.previewNotSupported') }}</p>
          </div>
        </div>

        <!-- Hint -->
        <div
          class="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-sm text-white/70 backdrop-blur-md"
        >
          {{ t('gallery.scrollHint') }}
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  currentFile: {
    type: Object,
    default: null,
  },
  currentIndex: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['close', 'prev', 'next']);

const { t } = useI18n();

// Zoom & Rotate state
const scale = ref(1);
const rotation = ref(0);

const zoomIn = () => {
  if (scale.value < 3) scale.value += 0.5;
};

const zoomOut = () => {
  if (scale.value > 0.5) scale.value -= 0.5;
};

const rotate = () => {
  rotation.value = (rotation.value + 90) % 360;
};

// Reset state when file changes
watch(() => props.currentFile, () => {
  scale.value = 1;
  rotation.value = 0;
});

const handleWheel = (e) => {
  if (e.ctrlKey || e.metaKey) {
    // Zoom
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  } else {
    // Navigation
    if (e.deltaY > 0) {
      emit('next');
    } else if (e.deltaY < 0) {
      emit('prev');
    }
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
    case '+':
    case '=':
      zoomIn();
      break;
    case '-':
    case '_':
      zoomOut();
      break;
    case 'r':
    case 'R':
      rotate();
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
