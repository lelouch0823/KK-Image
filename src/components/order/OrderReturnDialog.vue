<template>
  <Modal
    :model-value="modelValue"
    :title="t('order.detail.returnDialogTitle', 'Confirm Return')"
    size="md"
    body-class="space-y-4"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="$emit('cancel')"
  >
    <div class="space-y-4">
      <div class="rounded-xl border border-success/20 bg-(--color-success-bg) px-4 py-3">
        <p class="text-xs font-semibold tracking-wide text-(--color-success-text) uppercase">
          {{ t('order.detail.returnDialogSummaryLabel', 'Return Summary') }}
        </p>
        <p class="mt-1 text-sm text-(--text-main)">
          {{
            t(
              'order.detail.returnDialogSummary',
              { quantity, lineLabel },
              'Return {quantity} units from {lineLabel}.'
            )
          }}
        </p>
      </div>

      <label class="block">
        <span class="mb-1 block text-sm font-medium text-(--text-secondary)">
          {{ t('order.detail.returnReasonLabel', 'Reason Code') }}
        </span>
        <Select
          data-testid="return-reason-select"
          :model-value="reason"
          :options="reasonSelectOptions"
          size="sm"
          @update:model-value="reason = $event"
        />
      </label>

      <AppInput
        v-model="note"
        textarea
        rows="4"
        :label="t('order.detail.returnNoteLabel', 'Return Note')"
        :placeholder="
          t(
            'order.detail.returnNotePlaceholder',
            'Capture the return context for later audit and customer follow-up.'
          )
        "
      />
    </div>

    <template #footer>
      <AppButton
        variant="secondary"
        :text="t('common.cancel')"
        :disabled="loading"
        @click="$emit('cancel')"
      />
      <AppButton
        data-testid="return-confirm-button"
        variant="primary"
        :text="t('order.detail.returnAction', 'Return')"
        :disabled="!reason"
        :loading="loading"
        @click="handleConfirm"
      />
    </template>
  </Modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';
import Select from '@/components/ui/Select.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  quantity: {
    type: Number,
    default: 0,
  },
  lineLabel: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);
const { t } = useI18n();
const reason = ref('');
const note = ref('');

const reasonOptions = computed(() => [
  { value: 'customer_refused', label: t('order.returnReasons.customer_refused') },
  { value: 'wrong_item', label: t('order.returnReasons.wrong_item') },
  { value: 'damage', label: t('order.returnReasons.damage') },
  { value: 'quality_issue', label: t('order.returnReasons.quality_issue') },
  { value: 'logistics_failure', label: t('order.returnReasons.logistics_failure') },
  { value: 'other', label: t('order.returnReasons.other') },
]);

const reasonSelectOptions = computed(() => [
  { value: '', label: t('order.detail.returnReasonPlaceholder', 'Select a reason') },
  ...reasonOptions.value,
]);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      reason.value = '';
      note.value = '';
    }
  }
);

function handleConfirm() {
  if (!reason.value) return;
  emit('confirm', {
    reason: reason.value,
    note: note.value.trim(),
  });
}
</script>
