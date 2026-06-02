<template>
  <div ref="container" class="relative">
    <!-- 输入框 -->
    <div class="relative">
      <input
        :id="inputId"
        ref="inputEl"
        v-model="inputValue"
        v-bind="$attrs"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="inputClass"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="showDropdown"
        :aria-activedescendant="highlightedIndex >= 0 ? `${inputId}-opt-${highlightedIndex}` : undefined"
        @focus="handleFocus"
        @blur="handleBlur"
        @input="handleInput"
        @keydown="handleKeydown"
      />
      <!-- 加载指示器 -->
      <div
        v-if="loading"
        class="pointer-events-none absolute inset-y-0 right-3 flex items-center"
      >
        <svg class="size-4 animate-spin text-(--text-muted)" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    </div>

    <!-- 下拉建议列表 -->
    <Transition
      enter-active-class="transition duration-150 ease-out-expo"
      enter-from-class="transform scale-[0.97] opacity-0 -translate-y-1"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-100"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-[0.98] opacity-0"
    >
      <div
        v-if="showDropdown && displaySuggestions.length > 0"
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
            v-for="(suggestion, index) in displaySuggestions"
            :key="suggestion.value"
            :id="`${inputId}-opt-${index}`"
            type="button"
            role="option"
            :aria-selected="index === highlightedIndex"
            class="w-full px-3 py-2 text-left text-sm text-(--text-main) transition-colors hover:bg-(--bg-hover)"
            :class="{
              'bg-(--bg-muted)': index === highlightedIndex,
            }"
            @mousedown.prevent="selectSuggestion(suggestion)"
            @mouseenter="highlightedIndex = index"
          >
            <span v-html="highlightMatch(suggestion.label)" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, useId, useTemplateRef } from 'vue';
import { escapeHtml } from '@/utils/html';

/**
 * @typedef {Object} SuggestionItem
 * @property {string} value - 唯一标识
 * @property {string} label - 显示文本
 */

const props = defineProps({
  /** v-model 绑定值 */
  modelValue: { type: String, default: '' },
  /**
   * 建议列表
   * 支持字符串数组（向后兼容）或 { value, label } 对象数组
   */
  suggestions: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  inputClass: { type: String, default: 'input h-11' },
  label: { type: String, default: '' },
  /** 是否在本地过滤建议（false 时显示全部，适用于远程搜索场景） */
  filterMode: { type: Boolean, default: true },
  /** 是否正在加载远程数据 */
  loading: { type: Boolean, default: false },
  /** 是否禁用 */
  disabled: { type: Boolean, default: false },
  /** 触发显示下拉的最小字符数（仅远程模式有意义） */
  minChars: { type: Number, default: 0 },
});

const emit = defineEmits(['update:modelValue', 'select', 'search']);

const containerRef = useTemplateRef('container');
const inputEl = useTemplateRef('inputEl');
const inputValue = ref(props.modelValue);
const showDropdown = ref(false);
const highlightedIndex = ref(-1);
const inputId = useId();

// 统一建议格式：将字符串或对象都转为 { value, label }
const normalizedSuggestions = computed(() => {
  return props.suggestions.map((item) => {
    if (typeof item === 'string') {
      return { value: item, label: item };
    }
    return item;
  });
});

// 过滤后的建议列表
const filteredSuggestions = computed(() => {
  if (!props.filterMode || !inputValue.value) {
    return normalizedSuggestions.value;
  }
  const query = inputValue.value.toLowerCase();
  return normalizedSuggestions.value.filter((s) =>
    s.label.toLowerCase().includes(query)
  );
});

// 用于展示的建议列表（远程模式下当输入不足 minChars 时不显示）
const displaySuggestions = computed(() => {
  if (!props.filterMode && inputValue.value.trim().length < props.minChars) {
    return [];
  }
  return filteredSuggestions.value;
});

// 高亮匹配文本
function highlightMatch(text) {
  if (!inputValue.value || !props.filterMode) return escapeHtml(text);
  const query = inputValue.value.trim();
  if (!query) return escapeHtml(text);
  const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escapeHtml(text).replace(
    regex,
    '<mark class="bg-primary/20 text-(--text-main) rounded-sm px-0.5">$1</mark>'
  );
}

// 同步外部值
watch(
  () => props.modelValue,
  (val) => {
    inputValue.value = val;
  }
);

// 处理聚焦
const handleFocus = () => {
  showDropdown.value = true;
  highlightedIndex.value = -1;
};

// 处理失焦
const handleBlur = () => {
  // 延迟关闭，让 mousedown 事件先触发
  setTimeout(() => {
    showDropdown.value = false;
  }, 150);
};

// 处理输入
const handleInput = () => {
  emit('update:modelValue', inputValue.value);
  emit('search', inputValue.value);
  highlightedIndex.value = -1;
  showDropdown.value = true;
};

// 处理键盘导航
const handleKeydown = (e) => {
  if (!showDropdown.value || displaySuggestions.value.length === 0) {
    if (e.key === 'Escape') showDropdown.value = false;
    return;
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      highlightedIndex.value = Math.min(
        highlightedIndex.value + 1,
        displaySuggestions.value.length - 1
      );
      break;
    case 'ArrowUp':
      e.preventDefault();
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
      break;
    case 'Enter':
      if (highlightedIndex.value >= 0) {
        e.preventDefault();
        selectSuggestion(displaySuggestions.value[highlightedIndex.value]);
      }
      break;
    case 'Escape':
      showDropdown.value = false;
      break;
  }
};

// 选择建议
const selectSuggestion = (suggestion) => {
  inputValue.value = suggestion.label;
  emit('update:modelValue', suggestion.label);
  emit('select', suggestion);
  showDropdown.value = false;
};

// 暴露方法供外部调用
defineExpose({
  focus: () => inputEl.value?.focus(),
  blur: () => inputEl.value?.blur(),
  el: inputEl,
});
</script>
