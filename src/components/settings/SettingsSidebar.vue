<template>
  <nav class="flex flex-col gap-1">
    <button
      v-for="item in items"
      :key="item.id"
      class="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200"
      :class="[
        currentTab === item.id
          ? 'bg-[var(--color-primary-bg)] text-[var(--color-primary)] ring-[var(--color-primary-light)] shadow-sm ring-1 ring-inset'
          : 'text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--bg-hover)]',
      ]"
      @click="$emit('update:currentTab', item.id)"
    >
      <component
        :is="item.icon"
        class="size-5 shrink-0 transition-colors"
        :class="[currentTab === item.id ? 'text-[var(--color-primary)]' : 'group-hover:text-[var(--color-primary)] text-[var(--text-muted)]']"
      />
      <span>{{ item.label }}</span>
      <span
        v-if="item.badge"
        class="ml-auto rounded-full bg-[var(--color-info-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-info-text)]"
      >
        {{ item.badge }}
      </span>
    </button>
  </nav>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    required: true,
  },
  currentTab: {
    type: String,
    required: true,
  },
});

defineEmits(['update:currentTab']);
</script>
