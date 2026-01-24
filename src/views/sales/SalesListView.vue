<template>
  <OrderList
    :orders="orders"
    :loading="loading"
    @refresh="loadOrders"
    @view="handleViewOrder"
  />
</template>

<script setup>
import { inject } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import OrderList from '@/components/order/OrderList.vue';

const router = useRouter();
const route = useRoute();

// Inject shared state from Sales.vue (Layout)
const { orders, loading, loadOrders } = inject('salesContext');

const handleViewOrder = (order) => {
  // Clear new feedback flag locally if present
  if (order.hasNewFeedback) {
    order.hasNewFeedback = false;
  }
  
  router.push(`/sales/${route.params.token}/detail/${order.id}`);
};
</script>
