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
    default: 'bg-(--bg-muted) text-(--text-secondary) border-transparent',
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    info: 'bg-info/10 text-info border-info/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  const outlines = {
    default: 'bg-transparent text-(--text-muted) border-(--border-color)',
    primary: 'bg-transparent text-primary border-primary',
    success: 'bg-transparent text-success border-success',
    warning: 'bg-transparent text-warning border-warning',
    danger: 'bg-transparent text-danger border-danger',
    info: 'bg-transparent text-info border-info',
    purple: 'bg-transparent text-purple-500 border-purple-500',
  };

  return props.outline ? outlines[props.variant] : variants[props.variant];
});
</script>
