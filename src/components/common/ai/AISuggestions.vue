<template>
  <div
    v-if="suggestions.length > 0"
    class="scrollbar-hide flex gap-2 overflow-x-auto px-4 pt-1 pb-2"
  >
    <AppButton
      v-for="suggestion in suggestions"
      :key="suggestion"
      variant="white"
      size="sm"
      class="whitespace-nowrap !rounded-full hover:!border-primary/30 hover:!bg-primary/5 hover:!text-primary active:scale-95"
      @click="$emit('select', suggestion)"
    >
      {{ suggestion }}
    </AppButton>
  </div>
</template>

<script setup>
import AppButton from '@/components/ui/AppButton.vue';

defineProps({
  suggestions: {
    type: Array,
    default: () => [],
  },
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
