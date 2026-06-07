<template>
  <div class="w-full space-y-2">
    <label v-if="label" :for="inputId" class="block text-sm font-medium text-(--text-main)">
      {{ label }}
    </label>

    <div
      class="flex items-center gap-3 rounded-xl border border-(--border-color) bg-(--bg-card) p-2"
    >
      <label
        :for="inputId"
        class="flex h-10 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-muted)"
      >
        <input
          :id="inputId"
          :value="normalizedValue"
          type="color"
          :disabled="disabled"
          class="h-full w-full cursor-pointer border-none bg-transparent p-0"
          @input="handleInput"
          @change="$emit('change', $event.target.value)"
        />
      </label>

      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-(--text-main)">
          {{ normalizedValue }}
        </p>
        <p v-if="hint" class="text-xs text-(--text-secondary)">
          {{ hint }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '#ffffff',
  },
  id: {
    type: String,
    default: undefined,
  },
  label: {
    type: String,
    default: '',
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

const emit = defineEmits(['update:modelValue', 'change']);

const uid = useId();
const inputId = computed(() => props.id || uid);
const currentValue = ref(String(props.modelValue || '#ffffff'));
const normalizedValue = computed(() => String(currentValue.value || '#ffffff'));

watch(
  () => props.modelValue,
  (value) => {
    currentValue.value = String(value || '#ffffff');
  },
  { immediate: true }
);

const handleInput = (event) => {
  currentValue.value = event.target.value;
  emit('update:modelValue', event.target.value);
};
</script>
