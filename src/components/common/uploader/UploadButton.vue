<template>
  <label
    class="hover:border-primary hover:bg-(--bg-hover) group flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--border-color) transition-colors"
  >
    <input type="file" multiple class="hidden" @change="$emit('select', $event)" />
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
});

defineEmits(['select']);
</script>
