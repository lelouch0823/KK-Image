<template>
  <div class="relative">
    <input
      :id="inputId"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="input pl-9"
      :class="[inputClass, { 'pr-8': clearable && modelValue }]"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    <!-- 搜索图标 -->
    <AppIcon name="magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--text-muted)" />
    <!-- 清除按钮 -->
    <button
      v-if="clearable && modelValue"
      type="button"
      class="absolute top-1/2 right-2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center p-1 text-(--text-muted) transition-colors hover:text-(--text-main)"
      @click="clear"
    >
      <AppIcon name="x-mark" class="size-4" />
    </button>
  </div>
</template>

<script setup>
import { useId } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  debounce: {
    type: Number,
    default: 300,
  },
  clearable: {
    type: Boolean,
    default: true,
  },
  inputClass: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'search', 'clear']);

let debounceTimer = null;

const handleInput = (e) => {
  const value = e.target.value;
  emit('update:modelValue', value);

  if (props.debounce > 0) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      emit('search', value);
    }, props.debounce);
  } else {
    emit('search', value);
  }
};

const handleKeydown = (e) => {
  if (e.key === 'Enter') {
    clearTimeout(debounceTimer);
    emit('search', props.modelValue);
  }
};

const clear = () => {
  emit('update:modelValue', '');
  emit('search', '');
  emit('clear');
};

const inputId = useId();
</script>
