<template>
  <SalesStats :token="token" />
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import SalesStats from '@/components/order/SalesStats.vue';

const route = useRoute();
const token = computed(() => route.params.token);
</script>
