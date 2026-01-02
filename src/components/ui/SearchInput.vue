<template>
  <div class="relative">
    <input
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="focus:ring-primary focus:border-primary w-full rounded-lg border border-gray-300 py-2 pr-4 pl-9 text-sm transition-colors outline-none"
      :class="[inputClass, { 'pr-8': clearable && modelValue }]"
      @input="handleInput"
    />
    <!-- 搜索图标 -->
    <svg
      class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      ></path>
    </svg>
    <!-- 清除按钮 -->
    <button
      v-if="clearable && modelValue"
      type="button"
      class="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-gray-400 transition-colors hover:text-gray-600"
      @click="clear"
    >
      <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        ></path>
      </svg>
    </button>
  </div>
</template>

<script setup>
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
  inputClass: String,
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

const clear = () => {
  emit('update:modelValue', '');
  emit('search', '');
  emit('clear');
};
</script>
