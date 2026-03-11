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
    <AppIcon
      v-if="loading"
      name="spinner"
      class="animate-spin"
      :class="iconSizeClasses"
    />

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
import AppIcon from '@/components/ui/AppIcon.vue';

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
    primary: 'bg-primary text-(--text-inverse) hover:bg-(--color-primary-hover) focus:ring-primary/50',
    secondary: 'bg-(--bg-muted) text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-main) focus:ring-primary/20',
    danger: 'bg-danger text-white hover:opacity-90 focus:ring-danger/50',
    ghost: 'bg-transparent text-(--text-secondary) hover:bg-(--bg-muted) hover:text-(--text-main) focus:ring-primary/15',
    link: 'bg-transparent text-primary hover:underline p-0 h-auto',
    outline: 'border border-(--border-color) bg-transparent text-(--text-secondary) hover:border-(--text-secondary) hover:text-(--text-main)',
    white: 'border border-(--border-color) bg-(--bg-card) text-(--text-main) hover:bg-(--bg-hover) dark:bg-(--bg-muted) dark:text-(--text-main) focus:ring-primary/20',
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
