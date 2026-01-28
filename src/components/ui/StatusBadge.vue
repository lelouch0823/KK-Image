<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold border transition-colors duration-200"
    :class="computedClasses"
  >
    <span v-if="dot" class="size-1.5 rounded-full bg-current opacity-75"></span>
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'primary', 'success', 'warning', 'danger', 'info', 'purple'].includes(v),
  },
  label: { type: String, default: '' },
  dot: { type: Boolean, default: false },
  outline: { type: Boolean, default: false },
});

const computedClasses = computed(() => {
  const variants = {
    default: 'bg-gray-100 text-gray-600 border-transparent dark:bg-gray-800 dark:text-gray-300',
    primary: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20',
    success: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20',
    warning: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20',
    danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20',
    info: 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/20',
    purple: 'bg-[var(--color-purple)]/10 text-[var(--color-purple)] border-[var(--color-purple)]/20',
  };

  const outlines = {
    default: 'bg-transparent text-gray-500 border-gray-300 dark:text-gray-400 dark:border-gray-700',
    primary: 'bg-transparent text-[var(--color-primary)] border-[var(--color-primary)]',
    success: 'bg-transparent text-[var(--color-success)] border-[var(--color-success)]',
    warning: 'bg-transparent text-[var(--color-warning)] border-[var(--color-warning)]',
    danger: 'bg-transparent text-[var(--color-danger)] border-[var(--color-danger)]',
    info: 'bg-transparent text-[var(--color-info)] border-[var(--color-info)]',
    purple: 'bg-transparent text-[var(--color-purple)] border-[var(--color-purple)]',
  };

  return props.outline ? outlines[props.variant] : variants[props.variant];
});
</script>
