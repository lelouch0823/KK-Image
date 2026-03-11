<template>
  <div class="space-y-6">
    <PageHeader :title="title" :description="description">
      <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    </PageHeader>
    <div class="grid gap-6 xl:grid-cols-12">
      <div class="space-y-6 xl:col-span-8">
        <slot />
      </div>
      <aside v-if="$slots.aside" class="space-y-6 xl:col-span-4">
        <slot name="aside" />
      </aside>
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
