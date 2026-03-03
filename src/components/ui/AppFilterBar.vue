<template>
  <div class="flex-shrink-0 border-b border-(--border-color) p-3 sm:p-4">
    <!-- Header Row -->
    <div class="flex items-center justify-between gap-3">
      <!-- Title Area -->
      <div class="min-w-0">
        <slot name="title">
          <h2 v-if="title" class="truncate text-base font-semibold text-(--text-main) sm:text-lg">
            {{ title }}
          </h2>
          <p v-if="subtitle" class="hidden text-sm text-(--text-secondary) sm:block">
            {{ subtitle }}
          </p>
        </slot>
      </div>

      <!-- Actions Area -->
      <div class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <!-- Filters Row -->
    <div v-if="$slots.filters" class="mt-2.5 flex flex-wrap items-center gap-2 sm:mt-3">
      <slot name="filters" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },
});
</script>
