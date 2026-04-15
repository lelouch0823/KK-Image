<template>
  <div
    class="group relative overflow-hidden rounded-2xl border bg-(--bg-card) transition-all duration-200"
    :data-tone="accentTone"
    :class="[
      borderClass,
      clickable
        ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] active:shadow-sm'
        : 'shadow-sm',
    ]"
    @click="clickable && $emit('click', $event)"
  >
    <div
      v-if="$slots.header || indicator"
      class="border-b border-(--border-color) px-4 py-3"
      :class="headerClass"
    >
      <div v-if="indicator" class="flex items-center gap-2">
        <span class="size-2 rounded-full" :class="indicatorClass"></span>
        <slot name="header" />
      </div>
      <slot v-else name="header" />
    </div>

    <!-- Body -->
    <div :class="bodyClass">
      <slot />
    </div>

    <!-- Glow effect (if enabled) -->
    <div
      v-if="glow"
      class="absolute -top-6 -right-6 rounded-full p-12 opacity-20 blur-2xl transition-transform group-hover:opacity-40"
      :class="blobClass"
    ></div>

    <!-- Footer -->
    <div
      v-if="$slots.footer"
      class="border-t border-(--border-color) bg-(--bg-muted)/30 px-4 py-3"
      :class="footerClass"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getToneClasses, normalizeTone } from '@/design-system/toneContract';

const props = defineProps({
  clickable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  padding: { type: String, default: 'p-4' },
  headerClass: { type: String, default: '' },
  footerClass: { type: String, default: '' },
  activeBorder: { type: Boolean, default: false }, // Highlight border on active/selected
  indicator: { type: String, default: null }, // Color for the title indicator (e.g. 'rose', 'blue')
  glow: { type: Boolean, default: false },
});

defineEmits(['click']);

const accentTone = computed(() => normalizeTone(props.indicator || 'primary'));

const indicatorClass = computed(() => {
  if (!props.indicator) return '';
  return getToneClasses(props.indicator).dot;
});

const bodyClass = computed(() => {
  return props.padding;
});

const blobClass = computed(() => {
  return getToneClasses(accentTone.value).blob;
});

const borderClass = computed(() => {
  if (props.selected || props.activeBorder) {
    return 'border-primary ring-1 ring-primary';
  }
  return 'border-(--border-color) hover:border-(--border-hover)';
});
</script>
