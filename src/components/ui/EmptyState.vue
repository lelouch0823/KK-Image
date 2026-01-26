<template>
  <div class="animate-fade-in-up flex flex-col items-center justify-center py-12 text-center md:py-16" :class="containerClass">
    <!-- Icon Container with Blob Background -->
    <div class="relative mb-6">
      <!-- Decorative Blob -->
      <div 
        class="absolute inset-0 scale-150 rounded-full bg-linear-to-tr from-[var(--color-primary-bg)] to-transparent opacity-60 blur-xl"
      ></div>
      
      <!-- Icon Circle -->
      <div 
        class="shadow-soft relative flex items-center justify-center rounded-2xl bg-white transition-transform duration-300 hover:-translate-y-1 hover:scale-105 hover:shadow-lg" 
        :class="iconContainerClass"
      >
        <slot name="icon">
          <svg
            class="text-[var(--color-primary-light)] transition-colors duration-300 group-hover:text-[var(--color-primary)]"
            :class="iconClass"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              :d="iconPath"
            ></path>
          </svg>
        </slot>
      </div>
    </div>

    <!-- Title -->
    <h3 class="text-lg font-semibold tracking-tight text-[var(--text-main)]" :class="titleClass">
      <slot name="title">{{ title }}</slot>
    </h3>

    <!-- Description -->
    <p
      v-if="description || $slots.description"
      class="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]"
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

const props = defineProps({
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

const iconPaths = {
  folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  file: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  user: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z M21 21l-6-6', // Fallback for users if specific path needed
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  image:
    'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  inbox:
    'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  plus: 'M12 4v16m8-8H4',
};

const iconPath = computed(() => iconPaths[props.icon] || iconPaths.folder);

const iconContainerClass = computed(() => {
  const sizes = {
    sm: 'size-12',
    md: 'size-16',
    lg: 'size-20',
  };
  return sizes[props.size];
});

const iconSizeClass = computed(() => {
    // Determine icon size inside container
     const sizes = {
        sm: 'size-6',
        md: 'size-8',
        lg: 'size-10',
    };
    return sizes[props.size];
})
</script>
