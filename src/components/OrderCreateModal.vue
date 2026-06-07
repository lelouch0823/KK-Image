<template>
  <Modal
    :model-value="modelValue"
    size="2xl"
    :title="t('order.manage.createTitle')"
    @update:model-value="$emit('update:modelValue', false)"
  >
    <div class="p-4 sm:p-6">
      <OrderForm
        ref="orderFormRef"
        mode="admin"
        :salespersons="salespersons"
        :statuses="createStatuses"
        :submit-progress="submitProgress"
        @submit="handleSubmit"
        @cancel="$emit('update:modelValue', false)"
      />
    </div>
  </Modal>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import OrderForm from '@/components/order/OrderForm.vue';

const props = defineProps({
  modelValue: Boolean,
  salespersons: { type: Array, default: () => [] },
  statuses: { type: Array, default: () => [] },
});

const DEFAULT_CREATE_STATUSES = ['pending', 'confirmed', 'rejected', 'void'];
const ALLOWED_CREATE_STATUSES = new Set(DEFAULT_CREATE_STATUSES);

const emit = defineEmits(['update:modelValue', 'submit']);
const { t } = useI18n();

const submitProgress = ref({ step: '', current: 0, total: 0 });
const createStatuses = computed(() => {
  const source =
    Array.isArray(props.statuses) && props.statuses.length > 0
      ? props.statuses
      : DEFAULT_CREATE_STATUSES;
  return source.filter((status) => ALLOWED_CREATE_STATUSES.has(String(status || '').trim()));
});

const handleSubmit = async (data) => {
  emit('submit', { ...data });
};
</script>
