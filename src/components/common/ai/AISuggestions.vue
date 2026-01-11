<template>
  <div v-if="suggestions.length > 0" class="scrollbar-hide flex gap-2 overflow-x-auto px-4 pt-1 pb-2">
    <button
      v-for="suggestion in suggestions"
      :key="suggestion"
      class="hover:border-primary/30 hover:bg-primary/5 hover:text-primary rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs whitespace-nowrap text-gray-600 transition-all active:scale-95"
      @click="$emit('select', suggestion)"
    >
      {{ suggestion }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  suggestions: {
    type: Array,
    default: () => []
  }
});

defineEmits(['select']);
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>
