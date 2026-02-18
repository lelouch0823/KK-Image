<template>
  <div ref="container" class="relative">
    <!-- Trigger -->
    <button
      type="button"
      class="focus:ring-primary/20 focus:ring-2 focus:outline-none flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
      @click="toggle"
    >
      <span
        class="size-2 rounded-full"
        :class="getStatusColorClass(modelValue)"
      ></span>
      <span>{{ t(`order.statuses.${modelValue}`) }}</span>
      <svg
        class="text-secondary size-4 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        ></path>
      </svg>
    </button>

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      class="absolute right-0 z-50 overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg ring-1 ring-black/5 focus:outline-none"
      :class="[
        dropdownPosition === 'top' ? 'bottom-full mb-1 origin-bottom' : 'mt-1 origin-top',
        'max-h-60 w-48'
      ]"
    >
      <div class="p-1">
        <button
          v-for="status in options"
          :key="status"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
          :class="{ 'bg-[var(--bg-muted)]': modelValue === status }"
          @click="select(status)"
        >
          <span
            class="size-2 rounded-full"
            :class="getStatusColorClass(status)"
          ></span>
          <span class="flex-1 text-left">{{ t(`order.statuses.${status}`) }}</span>
          <svg
            v-if="modelValue === status"
            class="text-primary size-4"
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
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue';
import { useI18n } from '@/composables/useI18n';

defineProps({
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
const containerRef = useTemplateRef('container');
const dropdownPosition = ref('bottom');

const toggle = async () => {
  if (!isOpen.value) {
    isOpen.value = true;
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

const select = (status) => {
  emit('update:modelValue', status);
  isOpen.value = false;
};

// 获取状态颜色类（仅圆点颜色）
const getStatusColorClass = (status) => {
    // 映射状态到 Tailwind 颜色类 (参考 utils/status.js，提取 bg 部分并转换)
    const map = {
        pending: 'bg-[var(--color-warning)]',
        confirmed: 'bg-[var(--color-info)]',
        production: 'bg-[var(--color-orange)]', 
        shipping: 'bg-[var(--color-primary)]',
        completed: 'bg-[var(--color-success)]', // delivered/completed
        delivered: 'bg-[var(--color-success)]',
        arrived: 'bg-[var(--color-cyan)]',
        rejected: 'bg-[var(--color-danger)]',
        void: 'bg-[var(--text-muted)]',
    };
    return map[status] || 'bg-gray-400';
};

// 点击外部关闭
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
