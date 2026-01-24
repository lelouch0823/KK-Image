<template>
  <nav v-if="totalPages > 1" class="flex justify-center" :class="containerClass">
    <div class="flex gap-1">
      <!-- 上一页 -->
      <button
        v-if="showPrevNext"
        :disabled="currentPage === 1"
        class="rounded-md px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        :class="currentPage === 1 ? 'text-gray-400' : 'text-gray-600 hover:bg-gray-100'"
        @click="goToPage(currentPage - 1)"
      >
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          ></path>
        </svg>
      </button>

      <!-- 页码 -->
      <template v-for="page in visiblePages" :key="page">
        <span v-if="page === '...'" class="px-3 py-1 text-sm text-gray-400">...</span>
        <button
          v-else
          class="min-w-[32px] rounded-md px-3 py-1 text-sm transition-colors"
          :class="
            page === currentPage ? 'bg-primary text-white dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100'
          "
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
      </template>

      <!-- 下一页 -->
      <button
        v-if="showPrevNext"
        :disabled="currentPage === totalPages"
        class="rounded-md px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        :class="currentPage === totalPages ? 'text-gray-400' : 'text-gray-600 hover:bg-gray-100'"
        @click="goToPage(currentPage + 1)"
      >
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          ></path>
        </svg>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  currentPage: {
    type: Number,
    required: true,
  },
  totalPages: {
    type: Number,
    required: true,
  },
  maxVisible: {
    type: Number,
    default: 5,
  },
  showPrevNext: {
    type: Boolean,
    default: true,
  },
  containerClass: { type: String, default: '' },
});

const emit = defineEmits(['update:currentPage', 'change']);

const visiblePages = computed(() => {
  const pages = [];
  const total = props.totalPages;
  const current = props.currentPage;
  const max = props.maxVisible;

  if (total <= max) {
    // 显示所有页码
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    // 智能显示
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total, start + max - 1);

    if (end - start < max - 1) {
      start = Math.max(1, end - max + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      if (i !== 1 && i !== total) {
        pages.push(i);
      }
    }

    if (end < total) {
      if (end < total - 1) pages.push('...');
      pages.push(total);
    }
  }

  return pages;
});

const goToPage = (page) => {
  if (page < 1 || page > props.totalPages || page === props.currentPage) return;
  emit('update:currentPage', page);
  emit('change', page);
};
</script>
