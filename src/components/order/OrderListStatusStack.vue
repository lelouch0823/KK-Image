<template>
  <div class="flex flex-col gap-1" :class="containerClass">
    <OrderStatusChanger
      v-if="isInteractive"
      :status="status"
      :loading="loading"
      :permissions="permissions"
      :show-chevron="false"
      :can-deliver="canDeliver"
      :on-status-change="onStatusChange"
    />
    <AppTableStatusPill
      v-else
      :label="formatOrderStatusLabel(t, status)"
      :title="formatOrderStatusLabel(t, status)"
      :variant="getStatusVariant(status)"
      size="xs"
    />
    <OrderProcurementBadge :status="procurementStatus" :preset="procurementPreset" />
    <OrderDeliveryStatusBadge
      v-if="showDeliveryStatus"
      :status="deliveryStatus"
      :preset="deliveryPreset"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import OrderStatusChanger from '@/components/OrderStatusChanger.vue';
import OrderProcurementBadge from '@/components/order/OrderProcurementBadge.vue';
import OrderDeliveryStatusBadge from '@/components/order/OrderDeliveryStatusBadge.vue';
import AppTableStatusPill from '@/components/ui/AppTableStatusPill.vue';
import { getStatusVariant } from '@/utils/status';
import { formatOrderStatusLabel } from '@/utils/display-labels';

const props = defineProps({
  status: {
    type: String,
    required: true,
  },
  procurementStatus: {
    type: String,
    default: 'none',
  },
  deliveryStatus: {
    type: String,
    default: 'not_shipped',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  permissions: {
    type: Array,
    default: () => [],
  },
  canDeliver: {
    type: Boolean,
    default: true,
  },
  mode: {
    type: String,
    default: 'list',
  },
  onStatusChange: {
    type: Function,
    default: null,
  },
});

const { t } = useI18n();

const isInteractive = computed(() => props.mode === 'manage');

const containerClass = computed(() => {
  if (props.mode === 'manage') return 'items-center text-center';
  return 'items-end text-right';
});

const procurementPreset = computed(() => {
  if (props.mode === 'manage') return 'meta';
  return 'line';
});

const deliveryPreset = computed(() => {
  if (props.mode === 'manage') return 'meta';
  return 'line';
});

const showDeliveryStatus = computed(
  () => props.deliveryStatus && props.deliveryStatus !== 'not_shipped'
);
</script>
