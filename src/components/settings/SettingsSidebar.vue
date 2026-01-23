<template>
  <nav class="flex flex-col gap-1">
    <button
      v-for="item in items"
      :key="item.id"
      class="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200"
      :class="[
        currentTab === item.id
          ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/20'
          : 'text-secondary hover:bg-[var(--bg-hover)] hover:text-primary',
      ]"
      @click="$emit('update:currentTab', item.id)"
    >
      <component
        :is="item.icon"
        class="size-5 shrink-0 transition-colors"
        :class="[currentTab === item.id ? 'text-primary' : 'text-gray-400 group-hover:text-primary']"
      />
      <span>{{ item.label }}</span>
      <span
        v-if="item.badge"
        class="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
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
