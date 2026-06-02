<template>
  <StatusBadge
    :variant="variant"
    :dot="dot"
    :outline="outline"
    class="max-w-full whitespace-nowrap"
    :class="pillClass"
    :style="pillStyle"
    :title="resolvedTitle"
  >
    <span class="block truncate">{{ labelDisplay }}</span>
  </StatusBadge>
</template>

<script setup>
import { computed } from 'vue';
import StatusBadge from './StatusBadge.vue';

const props = defineProps({
  label: {
    type: [String, Number],
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  variant: {
    type: String,
    default: 'default',
  },
  dot: {
    type: Boolean,
    default: false,
  },
  outline: {
    type: Boolean,
    default: false,
  },
  maxWidth: {
    type: [String, Number],
    default: '6.5rem',
  },
  size: {
    type: String,
    default: 'xs',
  },
});

const labelDisplay = computed(() => {
  if (props.label === undefined || props.label === null || props.label === '') return '-';
  return String(props.label);
});

const resolvedTitle = computed(() => props.title || labelDisplay.value);

const pillClass = computed(() => {
  if (props.size === 'sm') {
    return '!px-2.5 !py-0.5 !text-xs !font-medium';
  }

  return '!px-2 !py-0.5 !text-xs !font-medium';
});

const pillStyle = computed(() => {
  if (!props.maxWidth) return undefined;
  return {
    maxWidth: typeof props.maxWidth === 'number' ? `${props.maxWidth}px` : props.maxWidth,
  };
});
</script>
