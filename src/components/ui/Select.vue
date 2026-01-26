<template>
  <div ref="containerRef" class="relative">
    <!-- Trigger -->
    <button
      type="button"
      class="flex w-full items-center justify-between border border-[var(--border-color)] bg-[var(--bg-card)] dark:bg-[var(--bg-muted)] text-left text-sm transition-all focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/10 focus:outline-none"
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
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 z-50 w-auto min-w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] whitespace-nowrap shadow-lg ring-1 ring-black/5 focus:outline-none"
        :class="[
          dropdownPosition === 'top' ? 'bottom-full mb-1 origin-bottom' : 'mt-1 origin-top',
          'max-h-72 overflow-y-auto'
        ]"
      >
        <div class="p-1">
          <div v-if="options.length === 0" class="text-secondary px-4 py-3 text-center text-sm">
            {{ emptyText }}
          </div>
          <button
            v-for="option in options"
            v-else
            :key="option.value"
            type="button"
            class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
            :class="{ 'bg-[var(--bg-muted)] font-medium text-[var(--color-primary)]': modelValue === option.value, 'text-[var(--text-main)]': modelValue !== option.value }"
            @click="select(option)"
          >
            <span class="truncate">{{ option.label }}</span>
            <svg
              v-if="modelValue === option.value"
              class="size-4 text-[var(--color-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  options: {
    type: Array,
    required: true,
    // Expected format: { label: string, value: string|number }[]
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
    default: 'default', // 'default' (h-11), 'sm' (h-9)
  },
});

const emit = defineEmits(['update:modelValue', 'change']);

const isOpen = ref(false);
const containerRef = ref(null);
const dropdownPosition = ref('bottom'); // 'bottom' or 'top'

const selectedLabel = computed(() => {
  const option = props.options.find((o) => o.value === props.modelValue);
  return option ? option.label : '';
});

const toggle = async () => {
  if (!isOpen.value) {
    isOpen.value = true;
    // Calculate position
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
  }
};

const select = (option) => {
  emit('update:modelValue', option.value);
  emit('change', option.value);
  isOpen.value = false;
};

const handleClickOutside = (event) => {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
