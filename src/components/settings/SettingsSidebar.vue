<template>
  <nav class="flex flex-col gap-1">
    <button
      v-for="item in items"
      :key="item.id"
      class="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200"
      :class="[
        currentTab === item.id
          ? 'bg-(--color-primary-bg) text-primary shadow-sm ring-1 ring-(--color-primary-light) ring-inset'
          : 'text-(--text-secondary) hover:bg-(--bg-hover) hover:text-primary',
      ]"
      @click="$emit('update:currentTab', item.id)"
    >
      <AppIcon
        :name="item.icon"
        class="size-5 shrink-0 transition-colors"
        :class="[currentTab === item.id ? 'text-primary' : 'text-(--text-muted) group-hover:text-primary']"
      />
      <span>{{ item.label }}</span>
      <span
        v-if="item.badge"
        class="ml-auto rounded-full bg-(--color-info-bg) px-2 py-0.5 text-xs font-medium text-(--color-info-text)"
      >
        {{ item.badge }}
      </span>
    </button>
  </nav>
</template>

<script setup>
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({
  items: {
    type: Array,
    required: true,
  },
  currentTab: {
    type: String,
    required: true,
  },
});

defineEmits(['update:currentTab']);
</script>
