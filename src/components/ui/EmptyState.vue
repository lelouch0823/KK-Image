<template>
  <div class="flex flex-col items-center justify-center py-12 text-center" :class="containerClass">
    <!-- Icon -->
    <div class="mb-4 flex items-center justify-center rounded-full" :class="iconContainerClass">
      <slot name="icon">
        <svg
          class="size-8 text-gray-300"
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

    <!-- Title -->
    <h3 class="text-primary text-lg font-medium" :class="titleClass">
      <slot name="title">{{ title }}</slot>
    </h3>

    <!-- Description -->
    <p
      v-if="description || $slots.description"
      class="text-secondary mt-1 max-w-sm text-sm"
      :class="descriptionClass"
    >
      <slot name="description">{{ description }}</slot>
    </p>

    <!-- Action -->
    <div v-if="$slots.action" class="mt-4">
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
    validator: (v) => ['folder', 'file', 'user', 'search', 'image', 'inbox', 'plus'].includes(v),
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  containerClass: String,
  iconClass: String,
  titleClass: String,
  descriptionClass: String,
});

const iconPaths = {
  folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  file: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  user: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
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
    sm: 'w-12 h-12 bg-gray-50 border border-dashed border-gray-200',
    md: 'w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-200',
    lg: 'w-20 h-20 bg-gray-100 border-2 border-dashed border-gray-200',
  };
  return sizes[props.size];
});
</script>
