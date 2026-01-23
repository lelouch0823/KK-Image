<template>
  <div class="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm transition-all hover:shadow-md">
    <div class="border-b border-[var(--border-color)] bg-gray-50/50 px-6 py-4 dark:bg-white/5">
      <div class="flex items-center gap-3">
        <div v-if="icon" class="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <component :is="icon" class="size-5" />
        </div>
        <div>
          <h3 class="text-base font-semibold text-primary">{{ title }}</h3>
          <p v-if="description" class="text-sm text-secondary">{{ description }}</p>
        </div>
        <div class="ml-auto">
          <slot name="action" />
        </div>
      </div>
    </div>
    <div class="p-6">
      <slot />
    </div>
    <div v-if="$slots.footer" class="bg-gray-50/50 px-6 py-4 border-t border-[var(--border-color)] dark:bg-white/5">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
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
