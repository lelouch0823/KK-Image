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
    default: 'bg-gray-100 text-gray-600',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    primary: 'bg-primary/10 text-primary',
    purple: 'bg-purple-100 text-purple-700',
    cyan: 'bg-cyan-100 text-cyan-700'
  };
  return variants[props.variant] || variants.default;
});

const dotClass = computed(() => {
  const dots = {
    default: 'bg-gray-400',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    primary: 'bg-primary',
    purple: 'bg-purple-500',
    cyan: 'bg-cyan-500'
  };
  return dots[props.variant] || dots.default;
});
</script>
