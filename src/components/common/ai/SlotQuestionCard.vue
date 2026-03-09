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
          <button
            v-for="(candidate, index) in field.candidates"
            :key="candidate.value || index"
            :data-testid="`candidate-option-${index}`"
            :data-selected="selectedCandidates[field.key]?.value === candidate.value ? 'true' : 'false'"
            :disabled="Boolean(selectedCandidates[field.key])"
            type="button"
            class="hover:bg-primary/5 block w-full rounded-lg bg-(--bg-card) px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            :class="selectedCandidates[field.key]?.value === candidate.value ? 'ring-primary/30 bg-primary/5 ring-2' : ''"
            @click="handleSelect(field.key, candidate, index)"
          >
            <p class="text-sm text-(--text-main)">{{ index + 1 }}. {{ candidate.label || candidate.value }}</p>
            <p v-if="candidate.description" class="mt-1 text-xs text-(--text-secondary)">{{ candidate.description }}</p>
          </button>
        </div>
        <div
          v-if="selectedCandidates[field.key]"
          class="border-primary/20 bg-primary/5 mt-3 rounded-lg border px-3 py-2"
        >
          <p class="text-xs font-medium text-(--text-main)">已选择</p>
          <p class="mt-1 text-sm text-(--text-main)">{{ selectedCandidates[field.key].label || selectedCandidates[field.key].value }}</p>
          <p v-if="selectedCandidates[field.key].description" class="mt-1 text-xs text-(--text-secondary)">
            {{ selectedCandidates[field.key].description }}
          </p>
        </div>
        <p class="mt-2 text-xs text-(--text-secondary)">回复序号、名称或 ID 即可选择。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const emit = defineEmits(['select']);

const props = defineProps({
  action: {
    type: Object,
    default: () => ({}),
  },
});

const selectedCandidates = ref({});
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

const handleSelect = (fieldKey, candidate, index) => {
  if (selectedCandidates.value[fieldKey]) return;
  selectedCandidates.value = {
    ...selectedCandidates.value,
    [fieldKey]: candidate,
  };
  emit('select', { fieldKey, candidate, index });
};
</script>
