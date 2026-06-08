<template>
  <div ref="container" class="relative" v-bind="$attrs">
    <!-- Trigger -->
    <button
      :id="triggerId"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-activedescendant="
        isOpen && highlightIndex >= 0 ? `${triggerId}-option-${highlightIndex}` : undefined
      "
      class="focus-visible:border-primary focus-visible:ring-primary/10 focus:outline-none flex w-full items-center justify-between border border-(--border-color) bg-(--bg-card) text-left text-sm transition-all dark:bg-(--bg-muted)"
      :class="[
        size === 'sm'
          ? 'h-9 rounded-lg px-2 focus-visible:ring-2'
          : 'h-11 rounded-xl px-4 focus-visible:ring-4',
        !modelValue ? 'text-(--text-secondary)' : 'text-(--text-main)',
      ]"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <span class="truncate">{{ selectedLabel || placeholder }}</span>
      <AppIcon
        name="chevron-down"
        class="shrink-0 text-(--text-secondary) transition-transform duration-200"
        :class="[size === 'sm' ? 'size-3.5' : 'size-4', { 'rotate-180': isOpen }]"
      />
    </button>

    <!-- Dropdown -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out-expo"
        enter-from-class="transform scale-[0.97] opacity-0 -translate-y-1"
        enter-to-class="transform scale-100 opacity-100 translate-y-0"
        leave-active-class="transition duration-100"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-[0.98] opacity-0"
      >
        <div
          v-if="isOpen"
          :id="`${triggerId}-listbox`"
          role="listbox"
          :data-select-id="triggerId"
          class="fixed z-[9999] overflow-auto rounded-lg border border-(--border-color) bg-(--bg-card) shadow-lg focus:outline-none"
          :style="dropdownStyle"
          :class="['max-h-60']"
        >
          <div class="p-1">
            <div
              v-if="options.length === 0"
              class="px-4 py-3 text-center text-sm text-(--text-secondary)"
            >
              {{ emptyText }}
            </div>
            <button
              v-for="(option, index) in options"
              v-else
              :id="`${triggerId}-option-${index}`"
              :key="option.value"
              type="button"
              role="option"
              :aria-selected="modelValue === option.value"
              class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-(--bg-hover)"
              :class="{
                'bg-(--bg-muted) text-(--text-main)': modelValue === option.value,
                'text-(--text-main)': modelValue !== option.value,
                'bg-(--bg-hover)': highlightIndex === index,
              }"
              @click="select(option)"
              @mouseenter="highlightIndex = index"
            >
              <span class="block flex-1 truncate text-left">{{ option.label }}</span>
              <AppIcon
                v-if="modelValue === option.value"
                name="check"
                class="text-primary ml-2 size-4 flex-shrink-0"
              />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, useId, useTemplateRef, watch } from 'vue';
import { useElementBounding } from '@vueuse/core';
import AppIcon from '@/components/ui/AppIcon.vue';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  options: {
    type: Array,
    required: true,
  },
  placeholder: {
    type: String,
    default: 'Select...',
  },
  emptyText: {
    type: String,
    default: 'No options',
  },
  size: {
    type: String,
    default: 'default',
  },
});

const emit = defineEmits(['update:modelValue', 'change']);

const isOpen = ref(false);
const highlightIndex = ref(-1);
const containerRef = useTemplateRef('container');
const triggerId = useId();

// Use VueUse for reactive bounding box
const { top, left, bottom, width, update } = useElementBounding(containerRef);

const dropdownPosition = ref('bottom');
const dropdownStyle = computed(() => {
  const style = {
    width: `${width.value}px`,
    left: `${left.value}px`,
    zIndex: 9999, // Ensure it's on top of everything
  };

  if (dropdownPosition.value === 'top') {
    style.bottom = `${window.innerHeight - top.value + 4}px`;
    style.top = 'auto';
  } else {
    style.top = `${bottom.value + 4}px`;
    style.bottom = 'auto';
  }

  return style;
});

const selectedLabel = computed(() => {
  const option = props.options.find((o) => o.value === props.modelValue);
  return option ? option.label : '';
});

const toggle = async () => {
  if (!isOpen.value) {
    update(); // Force update bounds

    // Calculate position preference
    const spaceBelow = window.innerHeight - bottom.value;
    const spaceAbove = top.value;

    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      dropdownPosition.value = 'top';
    } else {
      dropdownPosition.value = 'bottom';
    }

    isOpen.value = true;
    // 高亮当前选中项，若无选中项则高亮第一项
    const selectedIndex = props.options.findIndex((o) => o.value === props.modelValue);
    highlightIndex.value = selectedIndex >= 0 ? selectedIndex : 0;
  } else {
    isOpen.value = false;
    highlightIndex.value = -1;
  }
};

const select = (option) => {
  emit('update:modelValue', option.value);
  emit('change', option.value);
  isOpen.value = false;
  highlightIndex.value = -1;
};

const handleKeydown = (event) => {
  const { key } = event;
  const optionCount = props.options.length;

  if (optionCount === 0) return;

  switch (key) {
    case 'ArrowDown': {
      event.preventDefault();
      if (!isOpen.value) {
        toggle();
      } else {
        highlightIndex.value = (highlightIndex.value + 1) % optionCount;
        scrollToHighlighted();
      }
      break;
    }
    case 'ArrowUp': {
      event.preventDefault();
      if (!isOpen.value) {
        toggle();
      } else {
        highlightIndex.value = (highlightIndex.value - 1 + optionCount) % optionCount;
        scrollToHighlighted();
      }
      break;
    }
    case 'Enter': {
      event.preventDefault();
      if (isOpen.value && highlightIndex.value >= 0 && highlightIndex.value < optionCount) {
        select(props.options[highlightIndex.value]);
      } else if (!isOpen.value) {
        toggle();
      }
      break;
    }
    case 'Escape': {
      if (isOpen.value) {
        event.preventDefault();
        isOpen.value = false;
        highlightIndex.value = -1;
      }
      break;
    }
    case 'Home': {
      if (isOpen.value) {
        event.preventDefault();
        highlightIndex.value = 0;
        scrollToHighlighted();
      }
      break;
    }
    case 'End': {
      if (isOpen.value) {
        event.preventDefault();
        highlightIndex.value = optionCount - 1;
        scrollToHighlighted();
      }
      break;
    }
  }
};

const scrollToHighlighted = () => {
  const listboxEl = document.getElementById(`${triggerId}-listbox`);
  if (!listboxEl) return;
  const optionEl = document.getElementById(`${triggerId}-option-${highlightIndex.value}`);
  if (optionEl) {
    optionEl.scrollIntoView({ block: 'nearest' });
  }
};

// Close on scroll or resize to prevent detached dropdown
watch(isOpen, (val) => {
  if (val) {
    // window.addEventListener('scroll', close, { capture: true }); // Removed: Causes dropdown to close on any scroll
    window.addEventListener('resize', close);
  } else {
    // window.removeEventListener('scroll', close, { capture: true });
    window.removeEventListener('resize', close);
  }
});

const close = () => {
  if (isOpen.value) {
    isOpen.value = false;
    highlightIndex.value = -1;
  }
};

const handleClickOutside = (event) => {
  // Check if click is outside both container and dropdown (handled by overlay transparently if needed,
  // but logic here handles clicking elsewhere on page)
  // With Teleport, we need to check if target is inside container OR inside the dropdown content properly.
  // Actually, easiest way with Teleport is specific check or a transparent overlay.
  // We'll stick to document listener but check if target is inside trigger.

  if (containerRef.value && !containerRef.value.contains(event.target)) {
    // Also need to check if click is inside the dropdown itself (which is teleported).
    // We can add a ref to dropdown, but since it's v-if, we need to be careful.
    // A common pattern is checking .closest('.select-dropdown') if we add a class.
    const dropdownEl = document.querySelector(`[data-select-id="${triggerId}"]`);
    if (dropdownEl && dropdownEl.contains(event.target)) return;

    isOpen.value = false;
    highlightIndex.value = -1;
  }
};

// Use template ref on Teleported content via ID query or ref callback if possible.
// For simplicity, we can rely on click-outside logic on document.

import { onMounted, onUnmounted } from 'vue';

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  // window.removeEventListener('scroll', close, { capture: true });
  window.removeEventListener('resize', close);
});
</script>
