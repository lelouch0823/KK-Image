<template>
  <div class="min-w-0 space-y-1">
    <div
      class="truncate font-medium text-(--text-main)"
      :class="primaryClass"
      :title="resolvedPrimaryTitle"
    >
      {{ primaryDisplay }}
    </div>
    <div
      v-if="showSecondary"
      class="truncate text-xs text-(--text-secondary)"
      :class="secondaryClass"
      :title="resolvedSecondaryTitle"
    >
      {{ secondaryDisplay }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  primary: {
    type: [String, Number],
    default: '',
  },
  secondary: {
    type: [String, Number],
    default: '',
  },
  fallback: {
    type: String,
    default: '-',
  },
  primaryTitle: {
    type: String,
    default: '',
  },
  secondaryTitle: {
    type: String,
    default: '',
  },
  primaryClass: {
    type: [String, Array, Object],
    default: '',
  },
  secondaryClass: {
    type: [String, Array, Object],
    default: '',
  },
});

const primaryDisplay = computed(() => {
  return props.primary === undefined || props.primary === null || props.primary === ''
    ? props.fallback
    : String(props.primary);
});

const secondaryDisplay = computed(() => {
  return props.secondary === undefined || props.secondary === null || props.secondary === ''
    ? ''
    : String(props.secondary);
});

const showSecondary = computed(() => secondaryDisplay.value !== '');
const resolvedPrimaryTitle = computed(() => props.primaryTitle || primaryDisplay.value);
const resolvedSecondaryTitle = computed(() => props.secondaryTitle || secondaryDisplay.value);
</script>
