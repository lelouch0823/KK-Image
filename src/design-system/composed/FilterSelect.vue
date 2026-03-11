<template>
  <div class="min-w-[11rem]">
    <Select
      :model-value="modelValue"
      :options="options"
      :placeholder="placeholder"
      size="sm"
      @update:model-value="$emit('update:modelValue', $event)"
      @change="$emit('change', $event)"
    />
  </div>
</template>

<script setup>
import Select from '@/components/ui/Select.vue';

defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: 'Select...',
  },
});

defineEmits(['update:modelValue', 'change']);
</script>
