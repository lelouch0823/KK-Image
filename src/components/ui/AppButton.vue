<template>
  <button
    :type="type"
    class="relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:ring-2 focus:ring-offset-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      variantClasses,
      sizeClasses,
      { 'w-full': block }
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <!-- Loading Spinner -->
    <svg
      v-if="loading"
      class="animate-spin"
      :class="iconSizeClasses"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>

    <!-- Icon Left -->
    <slot v-else name="icon-left" />

    <!-- Content -->
    <span :class="{ 'opacity-0': loading && !loadingText }">
      <slot>{{ loadingText || text }}</slot>
    </span>

    <!-- Icon Right -->
    <slot v-if="!loading" name="icon-right" />
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  type: {
    type: String,
    default: 'button',
  },
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'danger', 'ghost', 'link', 'outline', 'white'].includes(v),
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'xl'].includes(v),
  },
  block: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  loadingText: {
    type: String,
    default: '',
  },
  text: {
    type: String,
    default: '',
  },
});

defineEmits(['click']);

const variantClasses = computed(() => {
  const variants = {
    primary: 'bg-[var(--color-primary)] text-[var(--text-inverse)] hover:bg-[var(--color-primary-hover)] focus:ring-[var(--color-primary)]/50',
    secondary: 'bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] focus:ring-gray-500/50',
    danger: 'bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] focus:ring-[var(--color-danger)]/50',
    ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)] focus:ring-gray-500/30',
    link: 'bg-transparent text-[var(--color-primary)] hover:underline p-0 h-auto',
    outline: 'border border-[var(--border-color)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-main)]',
    white: 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/20',
  };
  return variants[props.variant];
});

const sizeClasses = computed(() => {
  if (props.variant === 'link') return '';
  
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    xl: 'h-14 px-8 text-lg',
  };
  return sizes[props.size];
});

const iconSizeClasses = computed(() => {
  const sizes = {
    sm: 'size-3.5',
    md: 'size-4',
    lg: 'size-5',
    xl: 'size-6',
  };
  return sizes[props.size];
});
</script>
