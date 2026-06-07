<template>
  <div data-testid="outbox-event-table" class="space-y-3">
    <AppTable
      :columns="columns"
      :data="events"
      :loading="loading"
      :empty-text="t('common.noData')"
      table-layout="fixed"
      clickable
      no-border
      @row-click="$emit('select', $event)"
    >
      <template #cell-event_type="{ value }">
        <AppTableTextStack
          :primary="value || '-'"
          :secondary="t('outboxOps.table.selectHint', '点击查看详情与 replay 工作台')"
        />
      </template>

      <template #cell-aggregate_id="{ value, row }">
        <AppTableTextStack
          :primary="value || '-'"
          :secondary="
            row.id === selectedEventId
              ? t('outboxOps.table.selected', '当前选中')
              : `#${row.id || '-'}`
          "
          :secondary-title="row.id || '-'"
          primary-class="font-mono text-sm"
          :secondary-class="row.id === selectedEventId ? 'text-primary' : ''"
        />
      </template>

      <template #cell-consumers="{ row }">
        <div class="flex flex-wrap gap-1">
          <StatusBadge
            v-for="job in row.consumerJobs || []"
            :key="`${row.id}-${job.consumer_name}`"
            :variant="resolveVariant(job.status)"
            :outline="row.id !== selectedEventId"
            dot
          >
            {{ job.consumer_name }} · {{ job.status }}
          </StatusBadge>
          <span v-if="!(row.consumerJobs || []).length" class="text-sm text-(--text-secondary)"
            >-</span
          >
        </div>
      </template>

      <template #cell-created_at="{ value }">
        <span class="text-xs text-(--text-secondary)">{{ formatDate(value) }}</span>
      </template>
    </AppTable>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppTable from '@/components/ui/AppTable.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import AppTableTextStack from '@/components/ui/AppTableTextStack.vue';
import { formatDate } from '@/utils/formatters';
import { resolveVariant } from '@/utils/outbox-status';

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
  selectedEventId: {
    type: String,
    default: '',
  },
});

const { t } = useI18n();

const columns = computed(() => [
  {
    key: 'event_type',
    label: t('outboxOps.columns.eventType', '事件类型'),
    width: '240px',
    maxWidth: '240px',
  },
  {
    key: 'aggregate_id',
    label: t('outboxOps.columns.aggregateId', '聚合 ID'),
    kind: 'identifier',
    width: '260px',
    maxWidth: '260px',
  },
  { key: 'consumers', label: t('outboxOps.columns.consumers', '消费者') },
  {
    key: 'created_at',
    label: t('outboxOps.columns.createdAt', '创建时间'),
    kind: 'datetime',
    width: '180px',
  },
]);
</script>
