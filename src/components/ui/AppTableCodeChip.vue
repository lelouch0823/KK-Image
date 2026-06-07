<template>
  <span
    class="inline-block min-w-0 max-w-full truncate whitespace-nowrap rounded bg-(--bg-muted)"
    :class="[sizeClass, toneClass, selectable ? 'select-all' : '']"
    :style="chipStyle"
    :title="resolvedTitle"
  >
    {{ displayValue }}
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  value: {
    type: [String, Number],
    default: '',
  },
  fallback: {
    type: String,
    default: '-',
  },
  title: {
    type: String,
    default: '',
  },
  maxWidth: {
    type: [String, Number],
    default: '',
  },
  size: {
    type: String,
    default: 'xs',
  },
  tone: {
    type: String,
    default: 'secondary',
  },
  selectable: {
    type: Boolean,
    default: false,
  },
});

const displayValue = computed(() => {
  return props.value === undefined || props.value === null || props.value === ''
    ? props.fallback
    : String(props.value);
});

const resolvedTitle = computed(() => props.title || displayValue.value);

const chipStyle = computed(() => {
  if (!props.maxWidth) return undefined;
  return {
    maxWidth: typeof props.maxWidth === 'number' ? `${props.maxWidth}px` : props.maxWidth,
  };
});

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'px-2 py-0.5 font-mono text-sm';
  return 'px-1.5 py-0.5 font-mono text-xs';
});

const toneClass = computed(() => {
  if (props.tone === 'main') return 'text-(--text-main) dark:bg-(--bg-secondary)';
  return 'text-(--text-secondary)';
});
</script>
