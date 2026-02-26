<template>
  <div class="animate-fade-in-up flex flex-col items-center justify-center py-12 text-center md:py-16" :class="containerClass">
    <!-- Icon Container with Blob Background -->
    <div class="relative mb-6">
      <!-- Decorative Blob -->
      <div 
        class="from-primary-bg absolute inset-0 scale-150 rounded-full to-transparent opacity-60 blur-xl"
      ></div>
      
      <!-- Icon Circle -->
      <div 
        class="shadow-soft relative flex items-center justify-center rounded-2xl bg-(--bg-card) transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:shadow-lg" 
        :class="iconContainerClass"
      >
        <slot name="icon">
          <AppIcon
            :name="appIconName"
            class="text-primary-light transition-colors duration-300 group-hover:text-primary"
            :class="[iconClass, iconSizeClass]"
          />
        </slot>
      </div>
    </div>

    <!-- Title -->
    <h3 class="text-main text-lg font-semibold tracking-tight" :class="titleClass">
      <slot name="title">{{ title }}</slot>
    </h3>

    <!-- Description -->
    <p
      v-if="description || $slots.description"
      class="text-muted mt-2 max-w-sm text-sm leading-relaxed"
      :class="descriptionClass"
    >
      <slot name="description">{{ description }}</slot>
    </p>

    <!-- Action -->
    <div v-if="$slots.action" class="animate-scale-in mt-6" style="animation-delay: 0.1s">
      <slot name="action"></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const {
  title = '',
  description = '',
  icon = 'folder',
  size = 'md',
  containerClass = '',
  iconClass = '',
  titleClass = '',
  descriptionClass = '',
} = defineProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    default: 'folder',
    validator: (v) => ['folder', 'file', 'user', 'search', 'image', 'inbox', 'plus', 'users'].includes(v),
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  containerClass: { type: String, default: '' },
  iconClass: { type: String, default: '' },
  titleClass: { type: String, default: '' },
  descriptionClass: { type: String, default: '' },
});

const appIconMap = {
  folder: 'folder',
  file: 'document',
  user: 'user',
  users: 'users',
  search: 'magnifying-glass',
  image: 'photo',
  inbox: 'inbox',
  plus: 'plus',
};

const appIconName = computed(() => appIconMap[icon] || 'folder');

const iconContainerClass = computed(() => {
  const sizes = {
    sm: 'size-12',
    md: 'size-16',
    lg: 'size-20',
  };
  return sizes[size];
});

const iconSizeClass = computed(() => {
    // Determine icon size inside container
     const sizes = {
        sm: 'size-6',
        md: 'size-8',
        lg: 'size-10',
    };
    return sizes[size];
});
</script>
