<template>
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--border-color) bg-(--bg-card) px-4 py-3 shadow-sm">
    <div v-if="$slots.leading" class="flex items-center gap-2">
      <slot name="leading" />
    </div>
    <div class="flex items-center gap-2">
      <slot />
    </div>
  </div>
</template>
