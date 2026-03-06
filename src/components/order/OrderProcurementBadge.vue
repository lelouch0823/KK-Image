<template>
  <StatusBadge
    :variant="getProcurementStatusVariant(normalizedStatus)"
    :dot="dot"
    :outline="outline"
    :class="badgeClass"
  >
    <span v-if="showLabel" class="mr-1 text-[10px] font-medium opacity-80">
      {{ t('order.procurementStatus') }}
    </span>
    {{ t(`order.procurementStatuses.${normalizedStatus}`) }}
  </StatusBadge>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { normalizeProcurementStatus, getProcurementStatusVariant } from '@/utils/procurement-status';

const props = defineProps({
  status: {
    type: String,
    default: 'none',
  },
  dot: {
    type: Boolean,
    default: false,
  },
  outline: {
    type: Boolean,
    default: false,
  },
  showLabel: {
    type: Boolean,
    default: false,
  },
  compact: {
    type: Boolean,
    default: false,
  },
});

const { t } = useI18n();

const normalizedStatus = computed(() => normalizeProcurementStatus(props.status));

const badgeClass = computed(() => {
  if (props.compact) return '!px-2 !py-0.5 !text-[10px]';
  return '';
});
</script>
