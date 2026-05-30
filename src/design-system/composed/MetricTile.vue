<template>
  <div
    class="group relative overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) p-4 backdrop-blur-xl transition-all duration-300 sm:p-5"
    :data-tone="resolvedTone"
    :class="[
      clickable ? 'cursor-pointer' : '',
      active ? 'ring-primary/20 ring-2' : '',
      flat ? 'shadow-none' : 'shadow-card hover:-translate-y-0.5 hover:shadow-md',
    ]"
    @click="clickable && $emit('click')"
  >
    <div class="relative z-10 flex items-start justify-between">
      <div>
        <h3 class="text-xs font-medium text-(--text-secondary) sm:text-sm">{{ label }}</h3>
        <div
          class="mt-1.5 text-2xl font-semibold tracking-tight text-(--text-main) font-mono tabular-nums sm:mt-2 sm:text-3xl"
        >
          <slot name="value">{{ value }}</slot>
        </div>
      </div>
      <div
        class="flex size-9 items-center justify-center rounded-xl transition-colors sm:size-10"
        :class="iconWrapperClass"
      >
        <AppIcon
          v-if="icon"
          :name="icon"
          class="size-4 transition-transform duration-300 group-hover:scale-110 sm:size-5"
        />
      </div>
    </div>
    <div
      v-if="$slots.meta || meta"
      class="relative z-10 mt-2 flex items-center gap-2 text-xs font-medium text-(--text-secondary)"
    >
      <slot name="meta">{{ meta }}</slot>
    </div>
    <div
      class="absolute -top-4 -right-4 z-0 size-20 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-40"
      :class="blobClass"
    ></div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { getToneClasses, normalizeTone } from '@/design-system/toneContract';

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  icon: { type: String, default: '' },
  tone: { type: String, default: 'primary' },
  meta: { type: String, default: '' },
  clickable: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  flat: { type: Boolean, default: false },
});

defineEmits(['click']);

const resolvedTone = computed(() => normalizeTone(props.tone || 'primary'));
const iconWrapperClass = computed(() => getToneClasses(resolvedTone.value).iconSurface);
const blobClass = computed(() => getToneClasses(resolvedTone.value).blob);
</script>
