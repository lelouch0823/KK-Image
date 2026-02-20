<template>
  <div
    class="group relative aspect-square cursor-move overflow-hidden rounded-lg border-2 bg-[var(--bg-muted)] transition-all"
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
    <img :src="file.url" class="pointer-events-none size-full object-cover" />

    <!-- 操作遮罩层 -->
    <div
      v-if="!readonly"
      class="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
    >
      <!-- 替换按钮 -->
      <label
        class="flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/90 transition-colors hover:bg-white dark:bg-black/50 dark:hover:bg-black/70"
      >
        <input
          type="file"
          accept="image/*"
          class="hidden"
          @change="$emit('replace', $event)"
        />
        <svg
          class="text-secondary size-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          ></path>
        </svg>
      </label>
      <!-- 删除按钮 -->
      <button
        type="button"
        class="bg-danger flex size-8 items-center justify-center rounded-full transition-colors hover:bg-danger/90"
        @click="$emit('remove')"
      >
        <svg class="size-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          ></path>
        </svg>
      </button>
    </div>

    <!-- 主图/封面标记 -->
    <div
      v-if="isCover"
      class="bg-primary absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--text-inverse)] shadow-sm "
    >
      {{ coverText }}
    </div>

    <!-- 拖拽序号 -->
    <div
      class="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/50 text-[10px] text-white"
    >
      {{ index + 1 }}
    </div>
  </div>
</template>

<script setup>
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
