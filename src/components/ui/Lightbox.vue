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
        class="fixed inset-0 bg-black/95 backdrop-blur-md"
        :style="zIndexStyle"
        @click.self="$emit('close')"
        @wheel="handleWheel"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
      >
        <!-- Toolbar -->
        <div
          class="absolute top-0 right-0 left-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-4 transition-colors"
        >
          <div class="px-2 text-sm font-medium text-white/90">
            {{ currentIndex + 1 }} / {{ total }}
          </div>

          <div class="flex items-center gap-4">
            <!-- Zoom/Rotate Toolbar (Only for images) - Hidden on mobile -->
            <div v-if="isImage" class="mr-4 hidden items-center gap-2 border-r border-white/10 pr-4 sm:flex">
              <!-- Rotate -->
              <button
                type="button"
                class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                :aria-label="t('gallery.rotate')"
                :title="t('gallery.rotate')"
                @click.stop="rotate"
              >
                <AppIcon name="arrow-path" class="size-5" />
              </button>

              <!-- Zoom In -->
              <button
                type="button"
                class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                :aria-label="t('gallery.zoomIn')"
                :title="t('gallery.zoomIn')"
                @click.stop="zoomIn"
              >
                <AppIcon name="magnifying-glass-plus" class="size-5" />
              </button>

              <!-- Zoom Out -->
              <button
                type="button"
                class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                :aria-label="t('gallery.zoomOut')"
                :title="t('gallery.zoomOut')"
                @click.stop="zoomOut"
              >
                <AppIcon name="magnifying-glass-minus" class="size-5" />
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
              <AppIcon name="arrow-down-tray" class="size-4" />
              <span class="hidden sm:inline">{{ t('gallery.download') }}</span>
            </a>

            <!-- Close Button -->
            <button
              class="flex size-10 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
              :aria-label="t('gallery.close')"
              @click="$emit('close')"
            >
              <AppIcon name="x-mark" class="size-6" />
            </button>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <button
          v-if="currentIndex > 0"
          class="absolute top-1/2 left-4 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:flex"
          :aria-label="t('gallery.prev')"
          @click="$emit('prev')"
        >
          <AppIcon name="chevron-left" class="size-6" />
        </button>
        <button
          v-if="currentIndex < total - 1"
          class="absolute top-1/2 right-4 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white sm:flex"
          :aria-label="t('gallery.next')"
          @click="$emit('next')"
        >
          <AppIcon name="chevron-right" class="size-6" />
        </button>

        <!-- Content -->
        <div
          class="absolute inset-0 flex items-center justify-center overflow-hidden p-4 py-20 sm:p-8 md:p-12"
          @click.self="$emit('close')"
        >
          <!-- Image -->
          <img
            v-if="isImage"
            :src="currentFile.url"
            :alt="currentFile.name"
            class="max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-transform duration-200"
            :class="{ 'cursor-zoom-in': scale === 1, 'cursor-grab': scale > 1 }"
            :style="{ transform: `scale(${scale}) rotate(${rotation}deg)` }"
          />

          <!-- PDF Viewer -->
          <div
            v-else-if="isPdf"
            class="flex size-full max-w-5xl flex-col overflow-hidden rounded-lg bg-(--bg-card) shadow-2xl"
          >
            <iframe :src="currentFile.url" class="w-full flex-1 border-none"></iframe>
          </div>

          <!-- Other Files -->
          <div v-else class="text-center text-white">
            <div
              class="mx-auto mb-6 flex size-24 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md"
            >
              <AppIcon name="document" class="size-12" />
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useModalStack } from '@/composables/useModalStack';
import AppIcon from '@/components/ui/AppIcon.vue';

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

// SOTA: 使用 Modal 堆叠管理器，确保 Lightbox 始终显示在所有 Modal 之上
const { generateModalId, register, unregister, getZIndex } = useModalStack();
const lightboxId = ref(generateModalId());

// 动态计算 z-index 样式
const zIndexStyle = computed(() => ({
  zIndex: getZIndex(lightboxId.value),
}));

// 注册/注销 Lightbox
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      register(lightboxId.value);
    } else {
      unregister(lightboxId.value);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  unregister(lightboxId.value);
});

// 类型识别
const isImage = computed(() => {
  if (!props.currentFile) return false;
  const f = props.currentFile;
  // 优先检查显式的 type 字段，然后检查 mimeType，最后检查 URL 扩展名
  return (
    f.type === 'image' ||
    f.mimeType?.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(f.url || '')
  );
});

const isPdf = computed(() => {
  if (!props.currentFile) return false;
  const f = props.currentFile;
  return (
    f.type === 'pdf' ||
    f.mimeType === 'application/pdf' ||
    /\.pdf(\?.*)?$/i.test(f.url || '')
  );
});

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
watch(
  () => props.currentFile,
  () => {
    scale.value = 1;
    rotation.value = 0;
  }
);


const handleWheel = (e) => {
  if (e.ctrlKey || e.metaKey) {
    // Zoom
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  } else {
    // Prevent background scroll
    e.preventDefault();
    
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

// 触摸手势处理
const touchStartX = ref(0);
const touchStartY = ref(0);

const handleTouchStart = (e) => {
  touchStartX.value = e.touches[0].clientX;
  touchStartY.value = e.touches[0].clientY;
};

const handleTouchEnd = (e) => {
  if (scale.value > 1) return; // 放大时不触发滑动切换

  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;
  
  const deltaX = touchEndX - touchStartX.value;
  const deltaY = touchEndY - touchStartY.value;

  // 水平滑动 (阈值 50px)
  if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100) {
    if (deltaX > 0) {
      emit('prev');
    } else {
      emit('next');
    }
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>
