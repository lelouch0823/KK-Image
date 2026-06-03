<template>
  <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4 shadow-card">
    <div class="flex flex-wrap items-center gap-2">
      <span class="bg-primary/12 text-primary rounded-full px-2.5 py-1 text-xs font-medium">{{ t('common.ai.slotQuestion.step1') }}</span>
      <span class="rounded-full bg-(--bg-muted) px-2.5 py-1 text-xs font-medium text-(--text-secondary)">
        {{ candidateGroups.length > 0 ? t('common.ai.slotQuestion.canSelect') : t('common.ai.slotQuestion.continueFilling') }}
      </span>
    </div>
    <p class="mt-3 text-sm font-semibold text-(--text-main)">{{ t('common.ai.slotQuestion.needMoreInfo') }}</p>
    <p class="mt-1 text-sm leading-6 text-(--text-secondary)">{{ promptText }}</p>
    <p v-if="currentFieldLabel" class="mt-2 text-xs font-medium text-(--text-main)">
      {{ t('common.ai.slotQuestion.currentField') }}：{{ currentFieldLabel }}
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <span
        v-for="item in missingSlots"
        :key="item"
        class="rounded-full bg-(--bg-muted) px-3 py-1 text-xs font-medium text-(--text-secondary)"
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
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-medium text-(--text-main)">{{ field.label }} {{ t('common.ai.slotQuestion.candidates') }}</p>
          <span class="text-xs text-(--text-secondary)">{{ field.candidates.length }} {{ t('common.ai.slotQuestion.items') }}</span>
        </div>
        <div class="mt-2 space-y-2">
          <AppButton
            v-for="(candidate, index) in field.candidates"
            :key="candidate.value || index"
            :data-testid="`candidate-option-${index}`"
            :data-selected="selectedCandidates[field.key]?.value === candidate.value ? 'true' : 'false'"
            :disabled="Boolean(selectedCandidates[field.key])"
            variant="white"
            size="sm"
            class="!block !h-auto w-full !justify-start !rounded-lg px-3 py-2 !text-left disabled:cursor-not-allowed disabled:opacity-60"
            :class="
              selectedCandidates[field.key]?.value === candidate.value
                ? 'ring-primary/30 !bg-primary/5 ring-2'
                : ''
            "
            @click="handleSelect(field.key, candidate, index)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-(--text-main)">{{ index + 1 }}. {{ candidate.label || candidate.value }}</p>
                <p v-if="candidate.description" class="mt-1 text-xs text-(--text-secondary)">{{ candidate.description }}</p>
              </div>
              <span
                class="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-1 text-xs font-medium"
              >
                {{ t('common.ai.slotQuestion.select') }}
              </span>
            </div>
          </AppButton>
        </div>
        <div
          v-if="selectedCandidates[field.key]"
          class="border-primary/20 bg-primary/5 mt-3 rounded-lg border px-3 py-2"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-medium text-(--text-main)">{{ t('common.ai.slotQuestion.selected') }}</p>
            <AppButton
              :data-testid="`reselect-${field.key}`"
              variant="link"
              size="sm"
              class="text-xs font-medium"
              :text="t('common.ai.slotQuestion.reselect')"
              @click="clearSelection(field.key)"
            />
          </div>
          <p class="mt-1 text-sm font-medium text-(--text-main)">{{ selectedCandidates[field.key].label || selectedCandidates[field.key].value }}</p>
          <p v-if="selectedCandidates[field.key].description" class="mt-1 text-xs text-(--text-secondary)">
            {{ selectedCandidates[field.key].description }}
          </p>
        </div>
        <p class="mt-2 text-xs text-(--text-secondary)">{{ t('common.ai.slotQuestion.replyHint') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';

const { t } = useI18n();
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
const currentFieldLabel = computed(() => {
  const currentKey = String(props.action?.currentFieldKey || '').trim();
  if (!currentKey) return '';
  const currentField = candidateGroups.value.find((field) => field.key === currentKey);
  return currentField?.label || currentKey;
});
const promptText = computed(() => {
  if (typeof props.action?.prompt === 'string' && props.action.prompt.trim()) return props.action.prompt;
  return missingSlots.value.length > 0
    ? t('common.ai.slotQuestion.fillFields', { fields: missingSlots.value.join('、') })
    : t('common.ai.slotQuestion.continueInfo');
});

const handleSelect = (fieldKey, candidate, index) => {
  if (selectedCandidates.value[fieldKey]) return;
  selectedCandidates.value = {
    ...selectedCandidates.value,
    [fieldKey]: candidate,
  };
  emit('select', { fieldKey, candidate, index });
};

const clearSelection = (fieldKey) => {
  const nextSelected = { ...selectedCandidates.value };
  delete nextSelected[fieldKey];
  selectedCandidates.value = nextSelected;
};

watch(
  () => props.action,
  () => {
    selectedCandidates.value = {};
  }
);
</script>
