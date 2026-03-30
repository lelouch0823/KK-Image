<template>
  <div v-if="errorCode === 'FORBIDDEN'" class="rounded-xl border border-(--border-color) bg-(--bg-card) p-8">
    <PermissionDeniedState
      :title="t('outboxOps.permissionDenied', 'Outbox 运维权限不足')"
      :description="error || t('outboxOps.permissionDeniedDesc', '当前账号没有 outbox 运维读取权限，请联系管理员分配 audit:read。')"
      required-permission="audit:read"
      @retry="fetchEvents"
    />
  </div>
  <ManagementListShell
    v-else
    :title="t('outboxOps.title', 'Outbox 运维')"
    :description="t('outboxOps.subtitle', '查看事件消费状态，并对失败 side effect 做 dry-run / replay。')"
  >
    <template #filters>
      <AppInput
        v-model="filters.eventType"
        :placeholder="t('outboxOps.filters.eventType', '事件类型')"
      />
      <AppInput
        v-model="filters.consumerName"
        :placeholder="t('outboxOps.filters.consumerName', '消费者名称')"
      />
      <AppSelect
        v-model="filters.status"
        :options="statusOptions"
        :placeholder="t('outboxOps.filters.status', '消费状态')"
      />
    </template>

    <template #actions>
      <AppButton
        variant="secondary"
        :text="t('common.refresh')"
        @click="fetchEvents"
      />
    </template>

    <template #content>
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <OutboxEventTable
          :events="events"
          :loading="loading"
          @select="handleSelectEvent"
        />
        <OutboxReplayPanel
          :event="eventDetail"
          :detail-loading="detailLoading"
          :replay-loading="replayLoading"
          :last-replay-result="lastReplayResult"
          @refresh="handleRefreshDetail"
          @dry-run="handleDryRun"
          @execute="handleExecute"
        />
      </div>
    </template>
  </ManagementListShell>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useOutboxOps } from '@/composables/useOutboxOps';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/Select.vue';
import AppButton from '@/components/ui/AppButton.vue';
import OutboxEventTable from '@/components/outbox/OutboxEventTable.vue';
import OutboxReplayPanel from '@/components/outbox/OutboxReplayPanel.vue';

const { t } = useI18n();
const {
  events,
  loading,
  error,
  errorCode,
  eventDetail,
  detailLoading,
  replayLoading,
  lastReplayResult,
  loadEvents,
  loadEventDetail,
  dryRunReplay,
  executeReplay,
  clearReplayResult,
} = useOutboxOps();

const filters = reactive({
  eventType: '',
  consumerName: '',
  status: '',
});

const statusOptions = computed(() => ([
  { value: '', label: t('outboxOps.filters.allStatuses', '全部状态') },
  { value: 'pending', label: 'pending' },
  { value: 'processing', label: 'processing' },
  { value: 'published', label: 'published' },
  { value: 'failed', label: 'failed' },
  { value: 'skipped', label: 'skipped' },
]));

async function fetchEvents() {
  clearReplayResult();
  await loadEvents(filters);
}

async function handleSelectEvent(event) {
  clearReplayResult();
  await loadEventDetail(event?.id);
}

async function handleRefreshDetail(eventId) {
  if (!eventId) return;
  await loadEventDetail(eventId);
}

async function handleDryRun(payload) {
  await dryRunReplay(payload);
}

async function handleExecute(payload) {
  await executeReplay(payload);
}

onMounted(() => {
  fetchEvents();
});
</script>
