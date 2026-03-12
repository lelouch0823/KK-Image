<template>
  <div
    class="group relative overflow-hidden rounded-2xl bg-(--bg-card) p-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
    :class="[clickable ? 'cursor-pointer' : '', active ? 'ring-primary/20 ring-2' : '']"
    @click="clickable && $emit('click')"
  >
    <div class="relative z-10 flex items-start justify-between">
      <div>
        <h3 class="text-xs font-medium text-(--text-secondary) sm:text-sm">{{ label }}</h3>
        <div class="mt-1.5 text-2xl font-bold tracking-tight text-(--text-main) sm:mt-2 sm:text-3xl">
          <slot name="value">{{ value }}</slot>
        </div>
      </div>
      <div class="flex size-9 items-center justify-center rounded-xl transition-colors sm:size-10" :class="iconWrapperClass">
        <AppIcon v-if="icon" :name="icon" class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5" />
      </div>
    </div>
    <div v-if="$slots.meta || meta" class="relative z-10 mt-2 flex items-center gap-2 text-xs font-medium text-(--text-secondary)">
      <slot name="meta">{{ meta }}</slot>
    </div>
    <div class="absolute -top-4 -right-4 z-0 size-24 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-100" :class="blobClass"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  icon: { type: String, default: '' },
  tone: { type: String, default: 'primary' },
  meta: { type: String, default: '' },
  clickable: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
});

defineEmits(['click']);

const toneClassMap = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  purple: 'bg-(--color-purple-bg) text-(--color-purple)',
  cyan: 'bg-cyan-500/10 text-cyan-500',
  slate: 'bg-(--bg-muted) text-(--text-secondary)',
};

const blobClassMap = {
  primary: 'bg-primary/10',
  info: 'bg-info/10',
  warning: 'bg-warning/10',
  success: 'bg-success/10',
  danger: 'bg-danger/10',
  purple: 'bg-(--color-purple-bg)',
  cyan: 'bg-cyan-500/10',
  slate: 'bg-(--bg-muted)',
};

const iconWrapperClass = computed(() => toneClassMap[props.tone] || toneClassMap.primary);
const blobClass = computed(() => blobClassMap[props.tone] || blobClassMap.primary);
</script>
