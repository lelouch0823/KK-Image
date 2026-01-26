<template>
  <span class="inline-flex items-center rounded font-medium transition-colors duration-300" :class="[sizeClass, variantClass]">
    <span v-if="dot" class="mr-1.5 size-1.5 rounded-full" :class="dotClass"></span>
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: {
    type: String,
    default: '',
  },
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'success', 'warning', 'error', 'info', 'primary', 'purple', 'cyan'].includes(v),
  },
  size: {
    type: String,
    default: 'sm',
    validator: (v) => ['xs', 'sm', 'md'].includes(v),
  },
  dot: {
    type: Boolean,
    default: false,
  },
});

const sizeClass = computed(() => {
  const sizes = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };
  return sizes[props.size];
});

const variantClass = computed(() => {
  /* Premium Badge Colors */
  const variants = {
    default: 'bg-[var(--bg-muted)] text-[var(--text-secondary)] border border-[var(--border-color)]',
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--border-success)]',
    warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--border-warning)]',
    error: 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--border-danger)]',
    info: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--border-info)]',
    primary: 'bg-[var(--color-primary-bg)] text-[var(--color-primary)] border border-[var(--color-primary-light)]',
    purple: 'bg-[var(--color-purple-bg)] text-[var(--color-purple-text)] border border-[var(--color-purple-text)]/20',
    cyan: 'bg-[var(--color-cyan-bg)] text-[var(--color-cyan-text)] border border-[var(--color-cyan-text)]/20',
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
    primary: 'bg-[var(--color-primary)]',
    purple: 'bg-[var(--color-purple)]',
    cyan: 'bg-[var(--color-cyan)]',
  };
  return dots[props.variant] || dots.default;
});
</script>
