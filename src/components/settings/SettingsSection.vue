<template>
  <div class="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm transition-all hover:shadow-md">
    <div class="border-b border-[var(--border-color)] bg-[var(--bg-muted)] px-6 py-4">
      <div class="flex items-center gap-3">
        <div v-if="icon" class="flex size-10 items-center justify-center rounded-lg bg-[var(--color-primary-bg)] text-[var(--color-primary)]">
          <AppIcon :name="icon" class="size-5" />
        </div>
        <div>
          <h3 class="text-primary text-base font-semibold">{{ title }}</h3>
          <p v-if="description" class="text-secondary text-sm">{{ description }}</p>
        </div>
        <div class="ml-auto">
          <slot name="action" />
        </div>
      </div>
    </div>
    <div class="p-6">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-[var(--border-color)] bg-[var(--bg-muted)] px-6 py-4">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  icon: {
    type: Object, // Component or String
    default: null,
  },
});
</script>
