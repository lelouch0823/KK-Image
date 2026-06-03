<template>
  <span
    v-if="resolvedAppearance === 'meta'"
    class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-center text-xs font-medium"
    :class="metaClass"
  >
    <span class="size-1.5 rounded-full" :class="metaDotClass"></span>
    <span v-if="resolvedShowLabel" class="opacity-75">{{ t('order.procurementStatus') }}</span>
    <span>{{ t(`order.procurementStatuses.${normalizedStatus}`) }}</span>
  </span>
  <StatusBadge
    v-else
    :variant="getProcurementStatusVariant(normalizedStatus)"
    :dot="resolvedDot"
    :outline="outline"
    :class="badgeClass"
  >
    <span v-if="resolvedShowLabel" class="mr-1 text-xs font-medium opacity-80">
      {{ t('order.procurementStatus') }}
    </span>
    {{ t(`order.procurementStatuses.${normalizedStatus}`) }}
  </StatusBadge>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import {
  normalizeProcurementStatus,
  getProcurementStatusVariant,
} from '@/utils/procurement-status';

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
  appearance: {
    type: String,
    default: '',
  },
  preset: {
    type: String,
    default: '',
  },
});

const { t } = useI18n();

const normalizedStatus = computed(() => normalizeProcurementStatus(props.status));
const normalizedVariant = computed(() => getProcurementStatusVariant(normalizedStatus.value));

const presetConfig = computed(() => {
  const map = {
    meta: { appearance: 'meta' },
    line: { compact: true },
    detail: { compact: true, dot: true, showLabel: true },
  };
  return map[props.preset] || {};
});

const resolvedAppearance = computed(() => {
  return props.appearance || presetConfig.value.appearance || 'badge';
});

const resolvedDot = computed(() => {
  return props.dot || Boolean(presetConfig.value.dot);
});

const resolvedShowLabel = computed(() => {
  return props.showLabel || Boolean(presetConfig.value.showLabel);
});

const resolvedCompact = computed(() => {
  return props.compact || Boolean(presetConfig.value.compact);
});

const badgeClass = computed(() => {
  if (resolvedCompact.value) return '!px-2 !py-0.5 !text-xs whitespace-nowrap';
  return 'whitespace-nowrap';
});

const metaClass = computed(() => {
  const map = {
    default: 'text-(--text-muted)',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    info: 'text-info',
    purple: 'text-primary',
  };
  return map[normalizedVariant.value] || map.default;
});

const metaDotClass = computed(() => {
  const map = {
    default: 'bg-(--text-muted)',
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    purple: 'bg-primary',
  };
  return map[normalizedVariant.value] || map.default;
});
</script>
