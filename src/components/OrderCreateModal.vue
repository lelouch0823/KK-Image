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
        :statuses="statuses"
        :submit-progress="submitProgress"
        @submit="handleSubmit"
        @cancel="$emit('update:modelValue', false)"
      />
    </div>
  </Modal>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import OrderForm from '@/components/order/OrderForm.vue';

defineProps({
  modelValue: Boolean,
  salespersons: { type: Array, default: () => [] },
  statuses: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'submit']);
const { t } = useI18n();

const submitProgress = ref({ step: '', current: 0, total: 0 });

const handleSubmit = async (data) => {
  emit('submit', { ...data });
};
</script>
