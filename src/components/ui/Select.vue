<template>
  <div ref="container" class="relative">
    <!-- Trigger -->
    <button
      type="button"
      :id="triggerId"
      class="flex w-full items-center justify-between border border-[var(--border-color)] bg-[var(--bg-card)] text-left text-sm transition-all focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/10 focus:outline-none dark:bg-[var(--bg-muted)]"
      :class="[
        size === 'sm' ? 'h-9 rounded-lg px-2 focus:ring-2' : 'h-11 rounded-xl px-4 focus:ring-4',
        !modelValue ? 'text-[var(--text-secondary)]' : 'text-[var(--text-main)]'
      ]"
      @click="toggle"
    >
      <span class="truncate">{{ selectedLabel || placeholder }}</span>
      <svg
        class="shrink-0 text-[var(--text-secondary)] transition-transform duration-200"
        :class="[
          size === 'sm' ? 'size-3.5' : 'size-4',
          { 'rotate-180': isOpen }
        ]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isOpen"
          :data-select-id="triggerId"
          class="fixed z-[9999] overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg focus:outline-none"
          :style="dropdownStyle"
          :class="[
            'max-h-60'
          ]"
        >
          <div class="p-1">
            <div
              v-if="options.length === 0"
              class="px-4 py-3 text-center text-sm text-[var(--text-secondary)]"
            >
              {{ emptyText }}
            </div>
            <button
              v-for="option in options"
              v-else
              :key="option.value"
              type="button"
              class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
              :class="{
                'bg-[var(--bg-muted)] text-[var(--text-main)]': modelValue === option.value,
                'text-[var(--text-main)]': modelValue !== option.value,
              }"
              @click="select(option)"
            >
              <span class="truncate block text-left flex-1">{{ option.label }}</span>
              <svg
                v-if="modelValue === option.value"
                class="text-primary ml-2 size-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
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
  } else {
    isOpen.value = false;
  }
};

const select = (option) => {
  emit('update:modelValue', option.value);
  emit('change', option.value);
  isOpen.value = false;
};

// Close on scroll or resize to prevent detached dropdown
watch(isOpen, (val) => {
    if (val) {
        window.addEventListener('scroll', close, { capture: true });
        window.addEventListener('resize', close);
    } else {
        window.removeEventListener('scroll', close, { capture: true });
        window.removeEventListener('resize', close);
    }
});

const close = () => {
    if (isOpen.value) isOpen.value = false;
}

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
  window.removeEventListener('scroll', close, { capture: true });
  window.removeEventListener('resize', close);
});
</script>
