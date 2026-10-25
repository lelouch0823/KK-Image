<template>
  <label
    class="group flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--border-color) transition-colors"
    :class="
      disabled
        ? 'cursor-not-allowed opacity-50'
        : 'hover:border-primary hover:bg-(--bg-hover) cursor-pointer'
    "
    :aria-disabled="disabled || undefined"
  >
    <input
      type="file"
      multiple
      class="hidden"
      :disabled="disabled"
      @change="$emit('select', $event)"
    />
    <AppIcon name="plus" class="text-muted size-6 transition-colors group-hover:text-primary" />
    <span class="text-secondary mt-1 text-xs transition-colors group-hover:text-primary">{{
      text
    }}</span>
  </label>
</template>

<script setup>
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({
  text: { type: String, required: true },
  // 处理中保持占位但禁用，避免按钮消失造成布局跳动
  disabled: { type: Boolean, default: false },
});

defineEmits(['select']);
</script>
