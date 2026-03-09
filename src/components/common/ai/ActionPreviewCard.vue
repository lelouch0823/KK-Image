<template>
  <div class="border-primary/20 bg-primary/5 rounded-2xl border p-4 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-sm font-semibold text-(--text-main)">{{ titleText }}</p>
        <p class="mt-1 text-sm text-(--text-secondary)">请确认以下信息后再创建。</p>
      </div>
      <button
        type="button"
        class="bg-primary shrink-0 rounded-xl px-3 py-2 text-xs font-medium text-(--text-inverse) transition-colors hover:opacity-90"
        @click="$emit('confirm')"
      >
        确认创建
      </button>
    </div>

    <div class="mt-3 space-y-2">
      <div
        v-for="(value, key) in summaryEntries"
        :key="key"
        class="flex items-start justify-between gap-4 rounded-xl bg-(--bg-card) px-3 py-2"
      >
        <span class="text-xs text-(--text-secondary)">{{ key }}</span>
        <span class="text-right text-sm text-(--text-main)">{{ formatValue(value) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const emit = defineEmits(['confirm']);
defineExpose({ emit });

const props = defineProps({
  action: {
    type: Object,
    default: () => ({}),
  },
});

const titleText = computed(() => props.action?.title || '创建预览');
const summaryEntries = computed(() => props.action?.summary || {});

function formatValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '-');
}
</script>
