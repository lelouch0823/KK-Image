<template>
  <div class="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5">
    <h3 class="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
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
  blue: { bg: 'bg-blue-500', shadow: '59,130,246' },
  teal: { bg: 'bg-teal-500', shadow: '20,184,166' },
  orange: { bg: 'bg-orange-500', shadow: '249,115,22' },
  indigo: { bg: 'bg-indigo-500', shadow: '99,102,241' },
  pink: { bg: 'bg-pink-500', shadow: '236,72,153' },
};

const colorClass = computed(() => colors[props.color]?.bg || 'bg-blue-500');
const shadowColor = computed(() => colors[props.color]?.shadow || '59,130,246');
</script>
