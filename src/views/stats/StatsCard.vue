<template>
  <div
    class="group relative overflow-hidden rounded-2xl border border-white/10 p-6 backdrop-blur-md transition-all hover:bg-white/10"
    :class="[
      `border-white/10 bg-white/5 hover:shadow-[0_0_30px_rgba(var(--shadow-color),0.1)]`,
      colorClasses.wrapper
    ]"
    :style="{ '--shadow-color': shadowColor }"
  >
    <!-- Background Blob -->
    <div
      class="absolute -top-6 -right-6 rounded-full p-12 blur-2xl transition-transform"
      :class="[colorClasses.blob, 'opacity-80 group-hover:opacity-100']"
    ></div>

    <div class="relative z-10 flex items-start justify-between">
      <div>
        <p class="text-sm font-medium text-slate-500 dark:text-slate-400">
          {{ title }}
        </p>
        <h3 class="mt-2 font-mono text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {{ value }}
        </h3>
      </div>
      <div
        class="rounded-lg p-2 ring-1"
        :class="colorClasses.iconBg"
      >
        <slot name="icon"></slot>
      </div>
    </div>

    <!-- Footer / Subtext -->
    <div class="mt-4">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], required: true },
  color: { type: String, default: 'blue' }, // blue, emerald, purple, orange, pink
});

const colors = {
  blue: {
    wrapper: 'dark:hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]',
    blob: 'bg-blue-500/10 group-hover:bg-blue-500/20',
    iconBg: 'bg-blue-500/20 text-blue-400 ring-blue-500/30',
    shadow: '59,130,246',
  },
  emerald: {
    wrapper: 'dark:hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]',
    blob: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
    iconBg: 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30',
    shadow: '16,185,129',
  },
  purple: {
    wrapper: 'dark:hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]',
    blob: 'bg-purple-500/10 group-hover:bg-purple-500/20',
    iconBg: 'bg-purple-500/20 text-purple-400 ring-purple-500/30',
    shadow: '139,92,246',
  },
    orange: {
    wrapper: 'dark:hover:shadow-[0_0_30px_rgba(249,115,22,0.1)]',
    blob: 'bg-orange-500/10 group-hover:bg-orange-500/20',
    iconBg: 'bg-orange-500/20 text-orange-400 ring-orange-500/30',
    shadow: '249,115,22',
  },
  pink: {
    wrapper: 'dark:hover:shadow-[0_0_30px_rgba(236,72,153,0.1)]',
    blob: 'bg-pink-500/10 group-hover:bg-pink-500/20',
    iconBg: 'bg-pink-500/20 text-pink-400 ring-pink-500/30',
    shadow: '236,72,153',
  },
};

const colorClasses = computed(() => colors[props.color] || colors.blue);
const shadowColor = computed(() => colors[props.color]?.shadow || '59,130,246');
</script>
