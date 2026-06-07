<template>
  <div class="relative flex items-center justify-center">
    <input
      ref="inputEl"
      type="checkbox"
      class="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-(--border-color) bg-(--bg-card) transition-all duration-200 ease-in-out checked:border-primary! checked:bg-primary! hover:border-primary/50 focus-visible:ring-primary/20 focus-visible:ring-2 focus-visible:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      :checked="isChecked"
      :value="value"
      :disabled="disabled"
      @change="handleChange"
    />
    <AppIcon
      :name="indicatorIcon"
      class="pointer-events-none absolute top-1/2 left-1/2 size-3.5 -translate-1/2 text-(--bg-card) transition-opacity duration-200"
      :class="showIndicator ? 'opacity-100' : 'opacity-0'"
      stroke-width="3"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';

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
  indeterminate: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'change']);
const inputEl = ref(null);

const isChecked = computed(() => {
  if (props.checked !== undefined) return props.checked;

  if (Array.isArray(props.modelValue)) {
    return props.modelValue.includes(props.value);
  }
  return props.modelValue;
});

const showIndicator = computed(() => props.indeterminate || isChecked.value);
const indicatorIcon = computed(() => (props.indeterminate ? 'minus' : 'check'));

const syncIndeterminate = () => {
  if (inputEl.value) {
    inputEl.value.indeterminate = props.indeterminate;
  }
};

onMounted(syncIndeterminate);
watch(() => props.indeterminate, syncIndeterminate, { immediate: true });

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
