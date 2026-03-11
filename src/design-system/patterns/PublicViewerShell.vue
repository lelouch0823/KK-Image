<template>
  <div class="min-h-screen bg-(--bg-page) text-(--text-main)">
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader :title="title" :description="description">
        <template v-if="$slots.actions" #actions><slot name="actions" /></template>
      </PageHeader>
      <main class="mt-6">
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
