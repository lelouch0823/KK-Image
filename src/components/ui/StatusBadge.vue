<template>
  <span 
    class="inline-flex items-center font-medium rounded"
    :class="[sizeClass, variantClass]"
  >
    <span v-if="dot" class="mr-1.5 w-1.5 h-1.5 rounded-full" :class="dotClass"></span>
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: {
    type: String,
    default: ''
  },
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'success', 'warning', 'error', 'info', 'primary'].includes(v)
  },
  size: {
    type: String,
    default: 'sm',
    validator: (v) => ['xs', 'sm', 'md'].includes(v)
  },
  dot: {
    type: Boolean,
    default: false
  }
});

const sizeClass = computed(() => {
  const sizes = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm'
  };
  return sizes[props.size];
});

const variantClass = computed(() => {
  const variants = {
    default: 'bg-[var(--color-gray-100)] text-[var(--color-gray-600)]',
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
    warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
    error: 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
    info: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
    primary: 'bg-primary/10 text-primary',
    purple: 'bg-[var(--color-purple-bg)] text-[var(--color-purple-text)]',
    cyan: 'bg-[var(--color-cyan-bg)] text-[var(--color-cyan-text)]'
  };
  return variants[props.variant] || variants.default;
});

const dotClass = computed(() => {
  const dots = {
    default: 'bg-[var(--text-muted)]',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    error: 'bg-[var(--color-danger)]',
    info: 'bg-[var(--color-info)]',
    primary: 'bg-primary',
    purple: 'bg-[var(--color-purple)]',
    cyan: 'bg-[var(--color-cyan)]'
  };
  return dots[props.variant] || dots.default;
});
</script>
