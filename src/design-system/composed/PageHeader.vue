<template>
  <header
    data-page-header
    class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
  >
    <div class="min-w-0">
      <h1 class="text-2xl font-bold tracking-tight text-(--text-main) sm:text-3xl">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p
        v-if="description || $slots.description"
        class="mt-2 max-w-3xl text-sm text-(--text-secondary) sm:text-base"
      >
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
});
</script>
