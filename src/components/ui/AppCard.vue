<template>
  <div
    class="overflow-hidden rounded-2xl border bg-[var(--bg-card)] transition-all duration-200"
    :class="[
      borderClass,
      clickable
        ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] active:shadow-sm'
        : 'shadow-sm',
    ]"
    @click="clickable && $emit('click', $event)"
  >
    <!-- Header -->
    <div
      v-if="$slots.header"
      class="border-b border-[var(--border-color)] px-4 py-3"
      :class="headerClass"
    >
      <slot name="header" />
    </div>

    <!-- Body -->
    <div :class="bodyClass">
      <slot />
    </div>

    <!-- Footer -->
    <div
      v-if="$slots.footer"
      class="border-t border-[var(--border-color)] bg-[var(--bg-muted)]/30 px-4 py-3"
      :class="footerClass"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  clickable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  padding: { type: String, default: 'p-4' },
  headerClass: { type: String, default: '' },
  footerClass: { type: String, default: '' },
  activeBorder: { type: Boolean, default: false }, // Highlight border on active/selected
});

defineEmits(['click']);

const bodyClass = computed(() => {
  return props.padding;
});

const borderClass = computed(() => {
  if (props.selected || props.activeBorder) {
    return 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]';
  }
  return 'border-[var(--border-color)] hover:border-[var(--border-hover)]';
});
</script>
