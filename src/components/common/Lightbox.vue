<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
        @click.self="close"
        @wheel.prevent="handleWheel"
      >
        <!-- Top Bar -->
        <div class="absolute inset-x-0 top-0 flex items-center justify-between p-4 px-6 text-white/90">
          <div class="rounded-full bg-black/20 px-3 py-1 text-sm font-medium backdrop-blur-sm">
            {{ currentIndex + 1 }} / {{ total }}
          </div>
          
          <button
            class="rounded-full p-2 transition-colors hover:bg-white/10 active:scale-95"
            @click="close"
          >
            <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Previous Button -->
        <button
          v-if="hasPrev"
          class="absolute left-4 z-10 hidden rounded-full p-3 text-white/90 transition-colors hover:bg-white/10 active:scale-95 md:block"
          @click.stop="prev"
        >
          <svg class="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <!-- Main Image Area -->
        <div class="relative flex size-full items-center justify-center overflow-hidden">
          <Transition
            mode="out-in"
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <img
              v-if="currentFile"
              :key="currentFile.url"
              :src="currentFile.url"
              :style="{ transform: `scale(${scale}) rotate(${rotation}deg)` }"
              class="max-h-[85vh] max-w-[90vw] object-contain transition-transform duration-200"
              alt=""
              draggable="false"
              @click.stop
            />
          </Transition>
        </div>

        <!-- Next Button -->
        <button
          v-if="hasNext"
          class="absolute right-4 z-10 hidden rounded-full p-3 text-white/90 transition-colors hover:bg-white/10 active:scale-95 md:block"
          @click.stop="next"
        >
          <svg class="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <!-- Bottom Toolbar -->
        <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-6 pb-8">
          <div class="mx-auto flex max-w-3xl items-center justify-between text-white/90">
            <div class="truncate text-sm font-medium">
              {{ currentFile?.name || 'Image' }}
            </div>

            <div class="flex items-center gap-4">
              <!-- Rotate -->
              <button
                class="text-white/70 transition-colors hover:text-white"
                title="Rotate"
                @click.stop="rotate"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              <!-- Zoom In -->
              <button
                class="text-white/70 transition-colors hover:text-white"
                title="Zoom In"
                @click.stop="zoomIn"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>

              <!-- Zoom Out -->
              <button
                class="text-white/70 transition-colors hover:text-white"
                title="Zoom Out"
                @click.stop="zoomOut"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>

              <!-- Download -->
              <button
                class="text-white/70 transition-colors hover:text-white"
                title="Download"
                @click.stop="download"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  currentFile: { type: Object, default: null },
  currentIndex: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  hasPrev: { type: Boolean, default: false },
  hasNext: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'prev', 'next', 'download']);

// Zoom & Rotate state
const scale = ref(1);
const rotation = ref(0);

// Reset state when file changes
watch(() => props.currentFile, () => {
  scale.value = 1;
  rotation.value = 0;
});

const close = () => emit('close');
const prev = () => emit('prev');
const next = () => emit('next');

const zoomIn = () => {
  if (scale.value < 3) scale.value += 0.5;
};

const zoomOut = () => {
  if (scale.value > 0.5) scale.value -= 0.5;
};

const rotate = () => {
  rotation.value = (rotation.value + 90) % 360;
};

const download = () => {
  emit('download', props.currentFile);
};

// Handle wheel for zoom/nav
const handleWheel = (e) => {
  if (e.ctrlKey || e.metaKey) {
    // Zoom
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  } else {
    // Navigation (handled by parent via composable usually, but we can emit events)
    // Here relying on parent's useLightbox handleWheel might be better, 
    // but since we preventDefault here, we should emit or handle.
    // However, the useLightbox hook attaches wheel listener to window/document usually?
    // Let's defer to the prop methods for nav.
    // Actually simplicity:
    if (e.deltaY > 0 && props.hasNext) next();
    if (e.deltaY < 0 && props.hasPrev) prev();
  }
};
</script>
