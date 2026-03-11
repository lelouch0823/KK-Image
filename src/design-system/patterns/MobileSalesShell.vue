<template>
  <div class="min-h-screen bg-(--bg-page) text-(--text-main)">
    <div class="mx-auto max-w-screen-xl px-4 py-6 pb-24 sm:px-6">
      <PageHeader :title="title" :description="description">
        <template v-if="$slots.actions" #actions><slot name="actions" /></template>
      </PageHeader>
      <main class="mt-4">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import PageHeader from '@/design-system/composed/PageHeader.vue';

defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
});
</script>
