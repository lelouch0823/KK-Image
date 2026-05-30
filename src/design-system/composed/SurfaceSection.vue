<template>
  <section
    data-surface-section
    :data-surface-variant="variant"
    class="rounded-2xl border border-(--border-color) bg-(--bg-card)"
    :class="sectionClass"
  >
    <header
      v-if="title || $slots.header || $slots.actions"
      data-surface-section-header
      class="flex items-start justify-between gap-4 border-b border-(--border-color) px-5 py-4"
    >
      <div class="min-w-0 flex-1">
        <slot name="header">
          <h3 class="text-base font-semibold text-(--text-main)">{{ title }}</h3>
          <p v-if="description" class="mt-1 text-sm leading-6 text-(--text-secondary)">
            {{ description }}
          </p>
        </slot>
      </div>
      <div
        v-if="$slots.actions"
        data-surface-section-actions
        class="flex shrink-0 items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </header>

    <div data-surface-section-body class="px-5 py-4" :class="bodyClass">
      <slot />
    </div>
  </section>
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
  variant: {
    type: String,
    default: 'panel',
  },
  bodyClass: {
    type: String,
    default: '',
  },
});

const sectionClass = computed(() => {
  if (props.variant === 'muted') {
    return 'bg-(--bg-muted)/35';
  }

  return 'shadow-card transition-shadow duration-200 hover:shadow-md';
});
</script>
