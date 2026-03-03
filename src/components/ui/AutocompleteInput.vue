<template>
  <div ref="container" class="relative">
    <input
      :id="inputId"
      v-model="inputValue"
      v-bind="$attrs"
      :placeholder="placeholder"
      :class="inputClass"
      @focus="handleFocus"
      @blur="handleBlur"
      @input="handleInput"
      @keydown="handleKeydown"
    />

    <!-- 下拉建议列表 -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="showDropdown && filteredSuggestions.length > 0"
        class="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-card) shadow-lg"
      >
        <div class="max-h-48 overflow-y-auto py-1">
          <div
            v-if="label"
            class="bg-(--bg-muted) px-3 py-1.5 text-xs font-medium text-(--text-secondary)"
          >
            {{ label }}
          </div>
          <button
            v-for="(suggestion, index) in filteredSuggestions"
            :key="suggestion"
            type="button"
            class="w-full px-3 py-2 text-left text-sm text-(--text-main) transition-colors hover:bg-(--bg-hover)"
            :class="{
              'bg-(--bg-muted)': index === highlightedIndex,
            }"
            @mousedown.prevent="selectSuggestion(suggestion)"
            @mouseenter="highlightedIndex = index"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, useId, useTemplateRef } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  inputClass: { type: String, default: 'input h-11' },
  label: { type: String, default: '' },
  filterMode: { type: Boolean, default: true }, // true: 过滤建议, false: 始终显示全部
});

const emit = defineEmits(['update:modelValue', 'select']);

const containerRef = useTemplateRef('container');
const inputValue = ref(props.modelValue);
const showDropdown = ref(false);
const highlightedIndex = ref(-1);
const inputId = useId();

// 同步外部值
watch(
  () => props.modelValue,
  (val) => {
    inputValue.value = val;
  }
);

// 过滤后的建议列表
const filteredSuggestions = computed(() => {
  if (!props.filterMode || !inputValue.value) {
    return props.suggestions;
  }
  const query = inputValue.value.toLowerCase();
  return props.suggestions.filter((s) => s.toLowerCase().includes(query));
});

// 处理聚焦
const handleFocus = () => {
  showDropdown.value = true;
  highlightedIndex.value = -1;
};

// 处理失焦
const handleBlur = () => {
  // 延迟关闭，让点击事件先触发
  setTimeout(() => {
    showDropdown.value = false;
  }, 150);
};

// 处理输入
const handleInput = () => {
  emit('update:modelValue', inputValue.value);
  highlightedIndex.value = -1;
  showDropdown.value = true;
};

// 处理键盘导航
const handleKeydown = (e) => {
  if (!showDropdown.value || filteredSuggestions.value.length === 0) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      highlightedIndex.value = Math.min(
        highlightedIndex.value + 1,
        filteredSuggestions.value.length - 1
      );
      break;
    case 'ArrowUp':
      e.preventDefault();
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
      break;
    case 'Enter':
      if (highlightedIndex.value >= 0) {
        e.preventDefault();
        selectSuggestion(filteredSuggestions.value[highlightedIndex.value]);
      }
      break;
    case 'Escape':
      showDropdown.value = false;
      break;
  }
};

// 选择建议
const selectSuggestion = (suggestion) => {
  inputValue.value = suggestion;
  emit('update:modelValue', suggestion);
  emit('select', suggestion);
  showDropdown.value = false;
};
</script>
