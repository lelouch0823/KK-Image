<template>
  <StatusBadge :variant="variant" :dot="resolvedDot" :class="badgeClass">
    <span v-if="resolvedShowLabel" class="mr-1 text-xs font-medium opacity-80">
      {{ t('order.deliveryStatus') }}
    </span>
    {{ t(`order.deliveryStatuses.${normalizedStatus}`) }}
  </StatusBadge>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  status: {
    type: String,
    default: 'not_shipped',
  },
  preset: {
    type: String,
    default: '',
  },
});

const { t } = useI18n();

const normalizedStatus = computed(() => {
  const value = String(props.status || '')
    .trim()
    .toLowerCase();
  return value || 'not_shipped';
});

const variant = computed(() => {
  const map = {
    not_shipped: 'default',
    in_transit: 'info',
    delivered: 'success',
    partially_returned: 'warning',
    returned: 'warning',
  };
  return map[normalizedStatus.value] || 'default';
});

const resolvedShowLabel = computed(() => props.preset === 'detail');
const resolvedDot = computed(() => props.preset === 'detail');
const badgeClass = computed(() =>
  props.preset ? '!px-2 !py-0.5 !text-xs whitespace-nowrap' : 'whitespace-nowrap'
);
</script>
