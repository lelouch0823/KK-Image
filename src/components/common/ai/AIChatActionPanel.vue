<template>
  <SlotQuestionCard
    v-if="action?.type === 'slot_request'"
    :action="action"
    @select="$emit('select', $event)"
  />
  <ActionPreviewCard
    v-else-if="action?.type === 'action_preview'"
    :action="action"
    @confirm="$emit('confirm')"
  />
  <ActionResultCard v-else-if="action?.type === 'action_result'" :action="action" />
</template>

<script setup>
import SlotQuestionCard from './SlotQuestionCard.vue';
import ActionPreviewCard from './ActionPreviewCard.vue';
import ActionResultCard from './ActionResultCard.vue';

defineEmits(['select', 'confirm']);

defineProps({
  action: {
    type: Object,
    default: () => null,
  },
});
</script>
