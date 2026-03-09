<template>
  <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4 shadow-sm">
    <p class="text-sm font-semibold text-(--text-main)">还需要补充信息</p>
    <p class="mt-1 text-sm text-(--text-secondary)">{{ promptText }}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <span
        v-for="item in missingSlots"
        :key="item"
        class="rounded-full bg-(--bg-muted) px-3 py-1 text-xs text-(--text-secondary)"
      >
        {{ item }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  action: {
    type: Object,
    default: () => ({}),
  },
});

const missingSlots = computed(() => Array.isArray(props.action?.missingSlots) ? props.action.missingSlots : []);
const promptText = computed(() => {
  if (typeof props.action?.prompt === 'string' && props.action.prompt.trim()) return props.action.prompt;
  return missingSlots.value.length > 0
    ? `请补充以下字段：${missingSlots.value.join('、')}`
    : '请继续补充创建所需的信息。';
});
</script>
