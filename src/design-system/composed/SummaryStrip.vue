<template>
  <div
    data-summary-strip
    class="flex flex-wrap gap-4 rounded-2xl bg-(--bg-card) px-5 py-3"
    :class="flat ? 'shadow-none' : 'shadow-card'"
  >
    <slot />
  </div>
</template>

<script setup>
defineProps({
  flat: {
    type: Boolean,
    default: false,
  },
});
</script>
