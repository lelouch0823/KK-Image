<template>
  <div class="inline-flex max-w-[8.5rem] min-w-0 shrink-0" :class="containerClass">
    <OrderProcurementBadge
      :status="status"
      preset="line"
      :title="formatOrderProcurementStatusLabel(t, status)"
      class="max-w-full"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import OrderProcurementBadge from './OrderProcurementBadge.vue';
import { formatOrderProcurementStatusLabel } from '@/utils/display-labels';

const props = defineProps({
  status: {
    type: String,
    default: 'none',
  },
  align: {
    type: String,
    default: 'end',
  },
});

const { t } = useI18n();

const containerClass = computed(() => {
  if (props.align === 'start') return 'justify-start';
  if (props.align === 'center') return 'justify-center';
  return 'justify-end';
});
</script>
