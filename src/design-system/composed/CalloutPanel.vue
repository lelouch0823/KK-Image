<template>
  <div
    data-callout-panel
    :data-tone="resolvedTone"
    class="flex items-start gap-3 rounded-2xl border px-4 py-4"
    :class="panelClass"
  >
    <div
      data-callout-icon
      class="flex size-9 shrink-0 items-center justify-center rounded-xl"
      :class="iconClass"
    >
      <AppIcon :name="resolvedIcon" class="size-4.5" />
    </div>
    <div class="min-w-0 flex-1">
      <h3 v-if="title" class="text-sm font-semibold text-(--text-main)">{{ title }}</h3>
      <div class="text-sm leading-6 text-(--text-secondary)" :class="{ 'mt-1': title }">
        <slot>{{ description }}</slot>
      </div>
      <div
        v-if="$slots.actions"
        data-callout-actions
        class="mt-3 flex flex-wrap items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { getToneClasses, normalizeTone } from '@/design-system/toneContract';

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  tone: {
    type: String,
    default: 'info',
  },
  icon: {
    type: String,
    default: '',
  },
});

const resolvedTone = computed(() => normalizeTone(props.tone || 'info'));
const toneClasses = computed(() => getToneClasses(resolvedTone.value));
const panelClass = computed(() => toneClasses.value.surface);
const iconClass = computed(() => toneClasses.value.iconSurface);

const resolvedIcon = computed(() => {
  if (props.icon) return props.icon;

  const iconMap = {
    primary: 'sparkles',
    success: 'check-circle',
    warning: 'exclamation-triangle',
    danger: 'exclamation-circle',
    info: 'information-circle',
    neutral: 'information-circle',
  };

  return iconMap[resolvedTone.value] || 'information-circle';
});
</script>
