<template>
  <div
    :data-surface-variant="variant"
    data-state-panel
    class="rounded-2xl border border-transparent"
    :class="panelClass"
  >
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  variant: {
    type: String,
    default: 'panel',
  },
});

const panelClass = computed(() => {
  if (props.variant === 'plain') {
    return 'bg-transparent px-0 py-0 shadow-none ring-0';
  }

  if (props.variant === 'toolbar') {
    return 'bg-(--bg-card)/70 px-4 py-4 shadow-none ring-1 ring-(--border-color)/50 backdrop-blur-sm sm:px-5';
  }

  return 'bg-(--bg-card) p-5 shadow-card ring-1 ring-(--border-color)/40 sm:p-6';
});
</script>
