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
    <div v-if="candidateGroups.length > 0" class="mt-4 space-y-3">
      <div
        v-for="field in candidateGroups"
        :key="field.key"
        class="rounded-xl bg-(--bg-muted) p-3"
      >
        <p class="text-xs font-medium text-(--text-main)">{{ field.label }} 候选项</p>
        <div class="mt-2 space-y-2">
          <div
            v-for="(candidate, index) in field.candidates"
            :key="candidate.value || index"
            class="rounded-lg bg-(--bg-card) px-3 py-2"
          >
            <p class="text-sm text-(--text-main)">{{ index + 1 }}. {{ candidate.label || candidate.value }}</p>
            <p v-if="candidate.description" class="mt-1 text-xs text-(--text-secondary)">{{ candidate.description }}</p>
          </div>
        </div>
        <p class="mt-2 text-xs text-(--text-secondary)">回复序号、名称或 ID 即可选择。</p>
      </div>
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
const candidateGroups = computed(() => {
  const fields = Array.isArray(props.action?.fields) ? props.action.fields : [];
  return fields.filter((field) => Array.isArray(field?.candidates) && field.candidates.length > 0);
});
const promptText = computed(() => {
  if (typeof props.action?.prompt === 'string' && props.action.prompt.trim()) return props.action.prompt;
  return missingSlots.value.length > 0
    ? `请补充以下字段：${missingSlots.value.join('、')}`
    : '请继续补充创建所需的信息。';
});
</script>
