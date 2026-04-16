<template>
  <div class="w-full space-y-2">
    <div v-if="label || valueText" class="flex items-center justify-between gap-3">
      <label v-if="label" :for="inputId" class="text-sm font-medium text-(--text-main)">
        {{ label }}
      </label>
      <span v-if="valueText" class="text-xs font-medium text-(--text-secondary)">
        {{ valueText }}
      </span>
    </div>

    <input
      :id="inputId"
      :value="modelValue"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      class="slider-thumb:bg-primary slider-thumb:border-primary slider-thumb:size-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-(--bg-muted) accent-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      @input="$emit('update:modelValue', $event.target.value)"
      @change="$emit('change', $event.target.value)"
    />

    <p v-if="hint" class="text-xs text-(--text-secondary)">
      {{ hint }}
    </p>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue';

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: 0,
  },
  id: {
    type: String,
    default: undefined,
  },
  label: {
    type: String,
    default: '',
  },
  valueText: {
    type: String,
    default: '',
  },
  min: {
    type: [String, Number],
    default: 0,
  },
  max: {
    type: [String, Number],
    default: 100,
  },
  step: {
    type: [String, Number],
    default: 1,
  },
  hint: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['update:modelValue', 'change']);

const uid = useId();
const inputId = computed(() => props.id || uid);
</script>
