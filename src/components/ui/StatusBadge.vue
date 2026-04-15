<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-bold transition-colors duration-200"
    :data-tone="resolvedTone"
    :class="computedClasses"
  >
    <span v-if="dot" class="size-1.5 rounded-full bg-current opacity-75"></span>
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { getToneClasses, normalizeTone } from '@/design-system/toneContract';

const props = defineProps({
  variant: { type: String, default: 'neutral' },
  label: { type: String, default: '' },
  dot: { type: Boolean, default: false },
  outline: { type: Boolean, default: false },
});

const resolvedTone = computed(() => normalizeTone(props.variant || 'neutral'));

const computedClasses = computed(() => {
  const tones = getToneClasses(resolvedTone.value);
  return props.outline ? tones.badgeOutline : tones.badge;
});
</script>
