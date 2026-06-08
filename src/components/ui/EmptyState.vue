<template>
  <div
    class="flex flex-col items-center justify-center py-10 text-center md:py-14"
    :class="containerClass"
  >
    <!-- Icon Container -->
    <div class="relative mb-5">
      <div
        class="flex items-center justify-center rounded-2xl border border-(--border-subtle) bg-(--bg-muted)/50 transition-all duration-200"
        :class="iconContainerClass"
      >
        <slot name="icon">
          <AppIcon
            :name="appIconName"
            class="text-(--text-muted)"
            :class="[iconClass, iconSizeClass]"
          />
        </slot>
      </div>
    </div>

    <!-- Title -->
    <h3 class="text-sm font-medium text-(--text-main)" :class="titleClass">
      <slot name="title">{{ title }}</slot>
    </h3>

    <!-- Description -->
    <p
      v-if="description || $slots.description"
      class="text-(--text-muted) mt-1.5 max-w-xs text-xs leading-relaxed"
      :class="descriptionClass"
    >
      <slot name="description">{{ description }}</slot>
    </p>

    <!-- Action -->
    <div v-if="$slots.action" class="mt-5">
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
    validator: (v) =>
      [
        'folder',
        'file',
        'user',
        'search',
        'image',
        'inbox',
        'plus',
        'users',
        'check-circle',
        'no-symbol',
        'archive-box-x-mark',
        'chart-bar',
        'chart-pie',
      ].includes(v),
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
  'check-circle': 'check-circle',
  'no-symbol': 'no-symbol',
  'archive-box-x-mark': 'archive-box-x-mark',
  'chart-bar': 'chart-bar',
  'chart-pie': 'chart-pie',
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
