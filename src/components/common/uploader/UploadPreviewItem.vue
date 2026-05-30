<template>
  <div
    class="group relative aspect-square cursor-move overflow-hidden rounded-lg border-2 bg-(--bg-muted) transition-all"
    :class="dragClass"
    :data-sortable-index="index"
    draggable="true"
    @dragstart="$emit('drag-start', $event)"
    @dragend="$emit('drag-end')"
    @dragover.prevent="$emit('drag-over')"
    @dragleave="$emit('drag-leave')"
    @drop.prevent="$emit('drop')"
    @touchstart="$emit('touch-start', $event)"
    @touchmove="$emit('touch-move', $event)"
    @touchend="$emit('touch-end')"
  >
    <AppImage :src="file.url" :alt="file.name || '上传文件'" :lazy="false" class="pointer-events-none size-full" />

    <!-- 操作遮罩层 -->
    <div
      v-if="!readonly"
      class="absolute inset-0 flex items-center justify-center gap-2 bg-(--color-overlay-dim) opacity-0 transition-opacity group-hover:opacity-100"
    >
      <!-- 替换按钮 -->
      <label
        class="flex size-8 cursor-pointer items-center justify-center rounded-full bg-(--bg-card)/90 text-(--text-main) transition-colors hover:bg-(--bg-card)"
      >
        <input
          type="file"
          accept="image/*"
          class="hidden"
          @change="$emit('replace', $event)"
        />
        <AppIcon name="arrow-path" class="size-4" />
      </label>
      <!-- 删除按钮 -->
      <AppButton
        variant="danger"
        size="sm"
        class="!size-8 !rounded-full !p-0"
        @click="$emit('remove')"
      >
        <template #icon-left>
          <AppIcon name="trash" class="size-4 text-(--text-inverse)" />
        </template>
      </AppButton>
    </div>

    <!-- 主图/封面标记 -->
    <div
      v-if="isCover"
      class="bg-primary absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] text-(--text-inverse) shadow-sm "
    >
      {{ coverText }}
    </div>

    <!-- 拖拽序号 -->
    <div
      class="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-(--color-overlay-dim) text-[10px] text-(--text-inverse)"
    >
      {{ index + 1 }}
    </div>
  </div>
</template>

<script setup>
import AppImage from '@/components/ui/AppImage.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
defineProps({
  file: { type: Object, required: true },
  index: { type: Number, required: true },
  dragClass: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
  isCover: { type: Boolean, default: false },
  coverText: { type: String, default: '' },
});

defineEmits([
  'drag-start',
  'drag-end',
  'drag-over',
  'drag-leave',
  'drop',
  'touch-start',
  'touch-move',
  'touch-end',
  'replace',
  'remove',
]);
</script>
