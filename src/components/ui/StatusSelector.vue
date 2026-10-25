<template>
  <div ref="container" class="relative">
    <!-- Trigger -->
    <button
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-activedescendant="
        isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
      "
      class="focus-visible:ring-primary/20 focus-visible:ring-2 focus:outline-none flex items-center gap-2 rounded-full border border-(--border-color) bg-(--bg-card) px-3 py-1.5 text-sm font-medium transition-colors hover:bg-(--bg-hover)"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <span class="size-2 rounded-full" :class="getStatusColorClass(modelValue)"></span>
      <span>{{ formatOrderStatusLabel(t, modelValue) }}</span>
      <AppIcon
        name="chevron-down"
        class="text-secondary size-4 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      :id="listboxId"
      role="listbox"
      class="absolute right-0 z-50 overflow-auto rounded-lg border border-(--border-color) bg-(--bg-card) shadow-lg ring-1 ring-(--border-color)/40 focus:outline-none"
      :class="[
        dropdownPosition === 'top' ? 'bottom-full mb-1 origin-bottom' : 'mt-1 origin-top',
        'max-h-60 w-48',
      ]"
    >
      <div class="p-1">
        <button
          v-for="(status, index) in options"
          :id="`${listboxId}-option-${index}`"
          :key="status"
          type="button"
          role="option"
          :aria-selected="modelValue === status"
          class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-(--bg-hover)"
          :class="{
            'bg-(--bg-muted)': modelValue === status,
            'bg-(--bg-hover)': highlightedIndex === index,
          }"
          @click="select(status)"
          @mouseenter="highlightedIndex = index"
        >
          <span class="size-2 rounded-full" :class="getStatusColorClass(status)"></span>
          <span class="flex-1 text-left">{{ formatOrderStatusLabel(t, status) }}</span>
          <AppIcon v-if="modelValue === status" name="check" class="text-primary size-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, useId, useTemplateRef } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';
import { getStatusDotClass } from '@/design-system/toneContract';
import { formatOrderStatusLabel } from '@/utils/display-labels';

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  options: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const isOpen = ref(false);
const highlightedIndex = ref(-1);
const containerRef = useTemplateRef('container');
const dropdownPosition = ref('bottom');
const listboxId = useId();

const toggle = async () => {
  if (!isOpen.value) {
    isOpen.value = true;
    // 高亮当前选中项，未选中时高亮第一项，与 Select 组件行为一致
    const currentIndex = props.options.indexOf(props.modelValue);
    highlightedIndex.value = currentIndex >= 0 ? currentIndex : 0;
    await nextTick();
    if (containerRef.value) {
      const rect = containerRef.value.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If space below is less than 200px and space above is larger, flip to top
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        dropdownPosition.value = 'top';
      } else {
        dropdownPosition.value = 'bottom';
      }
    }
  } else {
    isOpen.value = false;
    highlightedIndex.value = -1;
  }
};

const select = (status) => {
  emit('update:modelValue', status);
  isOpen.value = false;
  highlightedIndex.value = -1;
};

const handleKeydown = (event) => {
  const optionCount = props.options.length;
  if (optionCount === 0) return;

  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault();
      if (!isOpen.value) {
        toggle();
      } else {
        highlightedIndex.value = (highlightedIndex.value + 1) % optionCount;
        scrollToHighlighted();
      }
      break;
    }
    case 'ArrowUp': {
      event.preventDefault();
      if (!isOpen.value) {
        toggle();
      } else {
        highlightedIndex.value = (highlightedIndex.value - 1 + optionCount) % optionCount;
        scrollToHighlighted();
      }
      break;
    }
    case 'Enter': {
      event.preventDefault();
      if (isOpen.value && highlightedIndex.value >= 0 && highlightedIndex.value < optionCount) {
        select(props.options[highlightedIndex.value]);
      } else if (!isOpen.value) {
        toggle();
      }
      break;
    }
    case 'Escape': {
      if (isOpen.value) {
        event.preventDefault();
        // 阻止冒泡到 document 上的 Modal 键盘监听，避免收起下拉时连带关闭底层弹窗
        event.stopPropagation();
        isOpen.value = false;
        highlightedIndex.value = -1;
      }
      break;
    }
    case 'Home': {
      if (isOpen.value) {
        event.preventDefault();
        highlightedIndex.value = 0;
        scrollToHighlighted();
      }
      break;
    }
    case 'End': {
      if (isOpen.value) {
        event.preventDefault();
        highlightedIndex.value = optionCount - 1;
        scrollToHighlighted();
      }
      break;
    }
  }
};

const scrollToHighlighted = () => {
  const optionEl = document.getElementById(`${listboxId}-option-${highlightedIndex.value}`);
  if (optionEl) {
    optionEl.scrollIntoView({ block: 'nearest' });
  }
};

// 获取状态颜色类（仅圆点颜色）
const getStatusColorClass = (status) => {
  return getStatusDotClass(status);
};

// 点击外部关闭
const handleClickOutside = (event) => {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    isOpen.value = false;
    highlightedIndex.value = -1;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
