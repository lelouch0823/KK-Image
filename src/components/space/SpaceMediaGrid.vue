<template>
  <div class="h-full">
    <!-- 有文件时显示网格 -->
    <div
      v-if="files.length > 0 || productImages.length > 0"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4"
    >
      <!-- Product Images (Read-only) -->
      <div
        v-for="(imgSrc, index) in productImages"
        :key="`product-img-${index}`"
        class="group relative aspect-square overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-muted)"
      >
        <AppImage
          :src="imgSrc"
          class="size-full opacity-90 transition-opacity hover:opacity-100"
          fit="cover"
          rounded="none"
        />
        <!-- 商品图标记 -->
        <div class="absolute top-2 left-2 rounded-full bg-blue-500/90 px-2 py-0.5 text-[10px] text-white shadow-sm backdrop-blur-sm">
          {{ t('product.text.image') || '商品图' }}
        </div>
      </div>

      <!-- Space Files (Draggable) -->
      <div
        v-for="(file, index) in localFiles"
        :key="file.id"
        class="group relative aspect-square cursor-grab overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-muted) transition-shadow hover:shadow-md active:cursor-grabbing"
        draggable="true"
        @dragstart="onDragStart($event, index)"
        @dragenter="onDragEnter($event, index)"
        @dragover.prevent
        @dragend="onDragEnd"
        @drop="onDrop($event, index)"
      >
        <AppImage
          v-if="isImageFile(file)"
          :src="file.url"
          :blurhash="file.blurhash"
          class="size-full"
          fit="cover"
          rounded="none"
        />
        <div v-else class="flex size-full flex-col items-center justify-center p-4">
          <span class="text-muted mb-2 text-xs font-bold uppercase">{{
            file.name?.split('.').pop()
          }}</span>
          <span class="text-secondary line-clamp-2 text-center text-xs">{{
            file.originalName || file.name
          }}</span>
        </div>

        <!-- 操作遮罩 -->
        <div
          class="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <button
            :title="t('spaceManager.setCover')"
            class="text-secondary rounded-full bg-white/90 p-2 transition-colors hover:bg-white"
            @click="$emit('setCover', file)"
          >
            <AppIcon name="photo" class="size-4" />
          </button>
          <button
            :title="t('spaceManager.remove')"
            class="text-danger rounded-full bg-white/90 p-2 transition-colors hover:bg-white"
            @click="$emit('remove', file.id)"
          >
            <AppIcon name="trash" class="size-4" />
          </button>
        </div>

        <!-- 封面标记 -->
        <div
          v-if="coverFileId === file.id"
          class="bg-primary absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] text-(--text-inverse) shadow-sm"
        >
          {{ t('spaceManager.cover') }}
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="text-secondary flex h-full flex-col items-center justify-center py-12">
      <AppIcon name="photo" class="mb-4 size-16 text-(--border-color)" />
      <p>{{ t('spaceManager.emptyMedia') }}</p>
      <button
        class="text-primary mt-4 text-sm transition-colors hover:underline"
        @click="$emit('addFiles')"
      >
        {{ t('spaceManager.addMediaHint') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { isImage } from '@/utils/formatters';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  files: {
    type: Array,
    default: () => [],
  },
  coverFileId: {
    type: [String, null],
    default: null,
  },
  productImages: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['setCover', 'remove', 'addFiles', 'reorder']);

const { t } = useI18n();

// Local copy of files for optimistic UI updates
const localFiles = ref([...props.files]);

// Watch for external changes
watch(() => props.files, (newFiles) => {
  localFiles.value = [...newFiles];
});

// Drag and Drop Logic
const dragIndex = ref(null);

const onDragStart = (e, index) => {
  dragIndex.value = index;
  e.dataTransfer.effectAllowed = 'move';
  // Optional: Set a drag image or custom opacity
  e.target.style.opacity = '0.5';
};

const onDragEnter = (_e, _index) => {
  // Optional: Add visual feedback for drop target
};

const onDragEnd = (e) => {
  dragIndex.value = null;
  e.target.style.opacity = '1';
};

const onDrop = (e, dropIndex) => {
  const startIndex = dragIndex.value;
  if (startIndex === null || startIndex === dropIndex) return;

  // Reorder local files
  const items = [...localFiles.value];
  const [draggedItem] = items.splice(startIndex, 1);
  items.splice(dropIndex, 0, draggedItem);
  
  localFiles.value = items;
  
  // Emit reorder event with new list
  emit('reorder', items);
};

// 检查文件是否为图片
const isImageFile = (file) => isImage(file);
</script>
