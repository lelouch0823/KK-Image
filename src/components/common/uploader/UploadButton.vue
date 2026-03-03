<template>
  <label
    class="hover:border-primary hover:bg-(--bg-hover) group flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--border-color) transition-colors"
  >
    <input type="file" multiple class="hidden" @change="$emit('select', $event)" />
    <svg
      class="text-muted size-6 transition-colors group-hover:text-primary"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 4v16m8-8H4"
      ></path>
    </svg>
    <span class="text-secondary mt-1 text-xs transition-colors group-hover:text-primary">{{
      text
    }}</span>
  </label>
</template>

<script setup>
defineProps({
  text: { type: String, required: true },
});

defineEmits(['select']);
</script>
