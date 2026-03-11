<template>
  <div
    class="grid gap-4"
    :class="columnsClass"
  >
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  columns: {
    type: Number,
    default: 4,
  },
});

const columnsClass = computed(() => {
  const map = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
  };
  return map[props.columns] || map[4];
});
</script>
