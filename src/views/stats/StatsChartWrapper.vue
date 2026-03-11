<template>
  <div class="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5">
    <h3 class="mb-6 flex items-center gap-2 text-lg font-semibold text-(--text-main)">
      <span
        class="size-2 rounded-full shadow-[0_0_8px_rgba(var(--dot-color),0.8)]"
        :class="colorClass"
        :style="{ '--dot-color': shadowColor }"
      ></span>
      {{ title }}
    </h3>
    <div class="relative h-80">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, required: true },
  color: { type: String, default: 'blue' },
});

const colors = {
  blue: { bg: 'bg-info', shadow: '59,130,246' },
  teal: { bg: 'bg-success', shadow: '16,185,129' },
  orange: { bg: 'bg-warning', shadow: '245,158,11' },
  indigo: { bg: 'bg-purple-500', shadow: 'var(--color-purple)' },
  pink: { bg: 'bg-danger', shadow: '239,68,68' },
};

const colorClass = computed(() => colors[props.color]?.bg || 'bg-info');
const shadowColor = computed(() => colors[props.color]?.shadow || '59,130,246');
</script>
