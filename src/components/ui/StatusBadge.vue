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
    validator: (v) => ['default', 'success', 'warning', 'error', 'info', 'primary'].includes(v),
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
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100',
    error: 'bg-rose-50 text-rose-700 border border-rose-100',
    info: 'bg-sky-50 text-sky-700 border border-sky-100',
    primary: 'bg-[var(--color-primary-bg)] text-[var(--color-primary)] border border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border border-purple-100',
    cyan: 'bg-cyan-50 text-cyan-700 border border-cyan-100',
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
    cyan: 'bg-[var(--color-cyan)]',
  };
  return dots[props.variant] || dots.default;
});
</script>
