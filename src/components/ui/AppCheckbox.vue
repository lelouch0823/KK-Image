<template>
  <div class="relative flex items-center justify-center">
    <input
      type="checkbox"
      class="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-[var(--border-color)] bg-[var(--bg-card)] transition-all duration-200 ease-in-out checked:border-[var(--color-primary)]! checked:bg-[var(--color-primary)]! hover:border-[var(--color-primary)]/50 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:bg-white/5 dark:focus:ring-offset-gray-900"
      :checked="isChecked"
      :value="value"
      :disabled="disabled"
      @change="handleChange"
    />
    <svg
      class="pointer-events-none absolute top-1/2 left-1/2 size-3.5 -translate-1/2 text-[var(--bg-card)] opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="3"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: [Boolean, Array],
    default: false,
  },
  value: {
    type: [String, Number, Object],
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  checked: {
    type: Boolean,
    default: undefined,
  },
});

const emit = defineEmits(['update:modelValue', 'change']);

const isChecked = computed(() => {
  if (props.checked !== undefined) return props.checked;
  
  if (Array.isArray(props.modelValue)) {
    return props.modelValue.includes(props.value);
  }
  return props.modelValue;
});

const handleChange = (e) => {
  const checked = e.target.checked;
  
  if (props.checked !== undefined) {
    emit('change', checked);
    return;
  }

  if (Array.isArray(props.modelValue)) {
    const newValue = [...props.modelValue];
    if (checked) {
      if (!newValue.includes(props.value)) {
        newValue.push(props.value);
      }
    } else {
      const index = newValue.indexOf(props.value);
      if (index > -1) {
        newValue.splice(index, 1);
      }
    }
    emit('update:modelValue', newValue);
  } else {
    emit('update:modelValue', checked);
  }
  emit('change', checked);
};
</script>
