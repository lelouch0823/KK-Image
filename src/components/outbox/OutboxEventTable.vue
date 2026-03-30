<template>
  <div data-testid="outbox-event-table" class="space-y-3">
    <AppTable
      :columns="columns"
      :data="events"
      :loading="loading"
      :empty-text="t('common.noData')"
      clickable
      no-border
      @row-click="$emit('select', $event)"
    >
      <template #cell-event_type="{ value }">
        <div class="font-medium text-(--text-main)">{{ value || '-' }}</div>
      </template>

      <template #cell-consumers="{ row }">
        <div class="flex flex-wrap gap-1">
          <StatusBadge
            v-for="job in row.consumerJobs || []"
            :key="`${row.id}-${job.consumer_name}`"
            variant="primary"
          >
            {{ job.consumer_name }} · {{ job.status }}
          </StatusBadge>
          <span v-if="!(row.consumerJobs || []).length" class="text-sm text-(--text-secondary)">-</span>
        </div>
      </template>

      <template #cell-created_at="{ value }">
        <span class="text-xs text-(--text-secondary)">{{ formatTime(value) }}</span>
      </template>
    </AppTable>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppTable from '@/components/ui/AppTable.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

defineEmits(['select']);

const props = defineProps({
  events: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const { t } = useI18n();

const columns = computed(() => ([
  { key: 'event_type', label: t('outboxOps.columns.eventType', '事件类型') },
  { key: 'aggregate_id', label: t('outboxOps.columns.aggregateId', '聚合 ID') },
  { key: 'consumers', label: t('outboxOps.columns.consumers', '消费者') },
  { key: 'created_at', label: t('outboxOps.columns.createdAt', '创建时间'), width: '180px' },
]));

function formatTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}
</script>
