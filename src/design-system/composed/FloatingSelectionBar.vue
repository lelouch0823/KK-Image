<template>
  <Transition
    enter-active-class="transition duration-250 ease-out-expo"
    enter-from-class="transform translate-y-3 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-out-expo"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-2 opacity-0"
  >
    <div
      v-if="visible"
      class="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-(--border-color) bg-(--bg-card) px-6 py-3 shadow-2xl backdrop-blur-xl"
    >
      <div class="flex items-center gap-3">
        <slot name="summary" />
      </div>
      <div class="flex items-center gap-2">
        <slot />
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
});
</script>
