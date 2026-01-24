<template>
  <OrderForm
    :prefill="prefillData"
    :submit-progress="submitProgress"
    @submit="handleSubmit"
    @cancel="handleCancel"
  />
</template>

<script setup>
import { ref, inject, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useOrders } from '@/composables/useOrders';
import OrderForm from '@/components/order/OrderForm.vue';

const router = useRouter();
const route = useRoute();
const { createSalesOrder } = useOrders();

const { prefillData, setPrefillData, loadOrders } = inject('salesContext');

const submitProgress = ref({ step: '', current: 0, total: 0 });

const handleSubmit = async (formData) => {
  const handleProgress = (step, current, total) => {
    submitProgress.value = { step, current, total };
  };

  const result = await createSalesOrder(route.params.token, formData, handleProgress);

  submitProgress.value = { step: '', current: 0, total: 0 };

  if (result) {
    if (loadOrders) await loadOrders();
    // Navigate back to list
    router.push(`/sales/${route.params.token}`);
  }
};

const handleCancel = () => {
  router.push(`/sales/${route.params.token}`);
};

// Cleanup prefill data when leaving form
onUnmounted(() => {
    if (setPrefillData) setPrefillData(null);
});
</script>
