<template>
  <div class="space-y-6">
    <PageHeader :title="title" :description="description">
      <template v-if="$slots.title" #title><slot name="title" /></template>
      <template v-if="$slots.description" #description><slot name="description" /></template>
      <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    </PageHeader>

    <div v-if="$slots.summary">
      <slot name="summary" />
    </div>

    <div v-if="$slots.main" class="grid gap-6 lg:grid-cols-12">
      <slot name="main" />
    </div>

    <div v-if="$slots.secondary">
      <slot name="secondary" />
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
