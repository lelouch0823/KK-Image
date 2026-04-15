<template>
  <div
    data-summary-strip
    class="flex flex-wrap gap-4 rounded-xl bg-(--bg-card) px-5 py-3"
    :class="flat ? 'shadow-none' : 'shadow-sm'"
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
