<template>
  <div class="border-(--color-success-border, #bbf7d0) bg-(--color-success-bg, #f0fdf4) rounded-2xl border p-4 shadow-sm">
    <p class="text-sm font-semibold text-(--text-main)">创建成功</p>
    <p class="mt-1 text-sm text-(--text-secondary)">{{ successText }}</p>
    <p v-if="entityLabel" class="mt-3 text-xs text-(--text-secondary)">编号：{{ entityLabel }}</p>
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

const successText = computed(() => props.action?.successMessage || '已完成创建，请前往对应模块查看。');
const entityLabel = computed(() => props.action?.createdEntityLabel || props.action?.createdEntityId || '');
</script>
