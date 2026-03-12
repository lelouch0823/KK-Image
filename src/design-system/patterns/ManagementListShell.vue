<template>
  <div class="space-y-6">
    <PageHeader :title="title" :description="description">
      <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    </PageHeader>

    <StatePanel v-if="$slots.filters" :variant="filtersVariant">
      <div class="flex flex-wrap items-center gap-3">
        <slot name="filters" />
      </div>
    </StatePanel>

    <div v-if="$slots.summary">
      <slot name="summary" />
    </div>

    <StatePanel v-if="$slots.content" variant="panel">
      <slot name="content" />
    </StatePanel>

    <div v-if="$slots.detail">
      <slot name="detail" />
    </div>

    <slot />
  </div>
</template>

<script setup>
import PageHeader from '@/design-system/composed/PageHeader.vue';
import StatePanel from '@/design-system/composed/StatePanel.vue';

defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  filtersVariant: { type: String, default: 'toolbar' },
});
</script>
