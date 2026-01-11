<template>
  <div class="animate-pulse" :class="containerClass">
    <!-- 预设形状 -->
    <template v-if="type === 'text'">
      <div class="h-4 rounded bg-[var(--color-gray-200)]" :class="widthClass"></div>
    </template>

    <template v-else-if="type === 'avatar'">
      <div class="rounded-full bg-[var(--color-gray-200)]" :class="avatarSizeClass"></div>
    </template>

    <template v-else-if="type === 'image'">
      <div class="rounded-lg bg-[var(--color-gray-200)]" :class="imageSizeClass"></div>
    </template>

    <template v-else-if="type === 'card'">
      <div class="space-y-3 rounded-xl bg-[var(--bg-muted)] p-4">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-full bg-[var(--color-gray-200)]"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-24 rounded bg-[var(--color-gray-200)]"></div>
            <div class="h-3 w-32 rounded bg-[var(--color-gray-200)]"></div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'table-row'">
      <tr>
        <td v-for="i in columns" :key="i" class="p-4">
          <div class="h-4 w-2/3 rounded bg-[var(--color-gray-200)]"></div>
        </td>
      </tr>
    </template>

    <!-- 自定义形状 -->
    <template v-else>
      <div class="rounded bg-[var(--color-gray-200)]" :class="customClass"></div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  type: {
    type: String,
    default: 'text',
    validator: (v) => ['text', 'avatar', 'image', 'card', 'table-row', 'custom'].includes(v),
  },
  width: {
    type: String,
    default: 'full',
  },
  height: {
    type: String,
    default: '',
  },
  count: {
    type: Number,
    default: 1,
  },
  columns: {
    type: Number,
    default: 4,
  },
  containerClass: { type: String, default: '' },
  customClass: { type: String, default: '' },
});

const widthClass = computed(() => {
  const widths = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '2/3': 'w-2/3',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
    '1/4': 'w-1/4',
  };
  return widths[props.width] || `w-[${props.width}]`;
});

const avatarSizeClass = computed(() => {
  return props.height ? `w-${props.height} h-${props.height}` : 'w-10 h-10';
});

const imageSizeClass = computed(() => {
  return props.height ? `h-${props.height}` : 'aspect-square w-full';
});
</script>
