<template>
  <div class="w-full">
    <!-- Label -->
    <label v-if="label" :for="inputId" class="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
      {{ label }}
      <span v-if="required" class="text-[var(--color-danger)]">*</span>
    </label>

    <div class="relative">
      <!-- Prepend Icon -->
      <div v-if="$slots.prepend && !textarea" class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-muted)]">
        <slot name="prepend" />
      </div>

      <!-- Input -->
      <component
        :is="textarea ? 'textarea' : 'input'"
        :id="inputId"
        ref="input"
        v-bind="$attrs"
        :value="modelValue"
        :type="!textarea ? type : undefined"
        :disabled="disabled"
        :required="required"
        class="block w-full rounded-lg border bg-[var(--bg-input)] text-[var(--text-main)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        :class="[
          inputClasses,
          error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]' : 'border-[var(--border-color)]',
          textarea ? 'resize-y' : ''
        ]"
        @input="$emit('update:modelValue', $event.target.value)"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      />

      <!-- Append Icon -->
      <div v-if="$slots.append && !textarea" class="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-muted)]">
        <slot name="append" />
      </div>
    </div>

    <!-- Error Message -->
    <p v-if="error" class="mt-1 text-xs text-[var(--color-danger)]">{{ error }}</p>
    <!-- Helper Text -->
    <p v-else-if="hint" class="mt-1 text-xs text-[var(--text-muted)]">{{ hint }}</p>
  </div>
</template>

<script setup>
import { computed, ref, useSlots, useId, useTemplateRef } from 'vue';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  label: { type: String, default: '' },
  id: { type: String, default: undefined },
  type: { type: String, default: 'text' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) },
  textarea: { type: Boolean, default: false },
});

defineEmits(['update:modelValue', 'blur', 'focus']);

const uid = useId();
const inputId = computed(() => props.id || uid);

const inputRef = useTemplateRef('input');
const slots = useSlots();

const inputClasses = computed(() => {
  const sizes = {
    sm: 'py-1 text-xs',
    md: 'py-2 text-sm',
    lg: 'py-3 text-base',
  };
  
  if (props.textarea) {
      return [sizes[props.size], 'px-3'];
  }

  const heightSizes = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
  };
  
  const paddingLeft = slots.prepend ? 'pl-10' : 'pl-3';
  const paddingRight = slots.append ? 'pr-10' : 'pr-3';

  return [heightSizes[props.size], sizes[props.size], paddingLeft, paddingRight];
});
</script>
