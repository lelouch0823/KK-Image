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

    <template #summary>
      <div data-testid="outbox-ops-summary" class="space-y-4">
        <StatePanel
          data-testid="outbox-ops-banner"
          variant="toolbar"
          class="border border-(--border-color)/50 bg-(--bg-card)/80"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex items-start gap-3">
              <div class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-warning/12 text-warning">
                <AppIcon name="shield-check" class="size-5" />
              </div>
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-base font-semibold text-(--text-main)">
                    {{ t('outboxOps.banner.title', '副作用链路工作台') }}
                  </h2>
                  <StatusBadge variant="warning" dot>
                    {{ t('outboxOps.banner.recommended', '建议先 Dry Run') }}
                  </StatusBadge>
                </div>
                <p class="max-w-3xl text-sm text-(--text-secondary)">
                  {{ t('outboxOps.banner.description', '这里用于排查 side effect 消费与重放，不改主业务事实。先看健康概览，再筛选事件，最后决定是否执行 replay。') }}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <StatusBadge variant="info" dot>
                {{ t('outboxOps.banner.scope', '仅处理已落库 outbox 事件') }}
              </StatusBadge>
              <StatusBadge :variant="filteredMetrics.failedJobs ? 'danger' : 'success'" dot>
                {{ filteredMetrics.failedJobs
                  ? t('outboxOps.banner.attention', { count: filteredMetrics.failedJobs })
                  : t('outboxOps.banner.clear', '当前筛选范围无失败消费者') }}
              </StatusBadge>
            </div>
          </div>
        </StatePanel>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <StatePanel variant="panel" class="space-y-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
                  {{ t('outboxOps.summary.globalLabel', '全局健康概览') }}
                </p>
                <p class="mt-1 text-sm text-(--text-secondary)">
                  {{ t('outboxOps.summary.globalDescription', '基于当前已加载事件集合，判断是否存在积压或失败信号。') }}
                </p>
              </div>
              <StatusBadge variant="primary" outline>
                {{ healthMetrics.totalEvents }} {{ t('outboxOps.summary.eventsUnit', '条事件') }}
              </StatusBadge>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <MetricTile
                :label="t('outboxOps.summary.totalEvents', '总事件数')"
                :value="healthMetrics.totalEvents"
                icon="chart-bar"
                tone="primary"
                flat
              />
              <MetricTile
                :label="t('outboxOps.summary.failedJobs', '失败消费者')"
                :value="healthMetrics.failedJobs"
                icon="exclamation-triangle"
                :tone="healthMetrics.failedJobs ? 'danger' : 'success'"
                flat
              />
              <MetricTile
                :label="t('outboxOps.summary.activeJobs', '待处理 / 处理中')"
                :value="healthMetrics.activeJobs"
                icon="arrow-path"
                :tone="healthMetrics.activeJobs ? 'warning' : 'slate'"
                flat
              />
              <MetricTile
                :label="t('outboxOps.summary.latestEvent', '最近事件时间')"
                :value="formatMetricValue(healthMetrics.latestCreatedAt)"
                icon="clock"
                tone="info"
                flat
              />
            </div>
          </StatePanel>

          <StatePanel variant="panel" class="space-y-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
                  {{ t('outboxOps.summary.focusLabel', '当前筛选结果') }}
                </p>
                <p class="mt-1 text-sm text-(--text-secondary)">
                  {{ filteredMetrics.hasFilters
                    ? t('outboxOps.summary.focusDescription', '以下摘要只反映你当前筛中的事件范围。')
                    : t('outboxOps.summary.focusDescriptionEmpty', '当前未设置筛选，默认展示全部可访问事件。') }}
                </p>
              </div>
              <StatusBadge :variant="filteredMetrics.hasFilters ? 'info' : 'default'" outline>
                {{ filteredMetrics.hasFilters
                  ? t('outboxOps.summary.filteredMode', '已聚焦')
                  : t('outboxOps.summary.unfilteredMode', '全量视图') }}
              </StatusBadge>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <MetricTile
                :label="t('outboxOps.summary.matchedEvents', '命中事件')"
                :value="filteredMetrics.totalEvents"
                icon="eye"
                tone="primary"
                flat
              />
              <MetricTile
                :label="t('outboxOps.summary.focusFailed', '命中范围失败消费者')"
                :value="filteredMetrics.failedJobs"
                icon="exclamation-circle"
                :tone="filteredMetrics.failedJobs ? 'danger' : 'success'"
                flat
              />
              <MetricTile
                :label="t('outboxOps.summary.focusActive', '命中范围待处理')"
                :value="filteredMetrics.activeJobs"
                icon="bolt"
                :tone="filteredMetrics.activeJobs ? 'warning' : 'slate'"
                flat
              />
              <MetricTile
                :label="t('outboxOps.summary.latestFocus', '范围内最近事件')"
                :value="formatMetricValue(filteredMetrics.latestCreatedAt)"
                icon="clock"
                tone="info"
                flat
              />
            </div>

            <SummaryStrip flat class="border border-(--border-color)/50 bg-(--bg-muted)/35">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-semibold tracking-[0.12em] text-(--text-muted) uppercase">
                  {{ t('outboxOps.summary.filtersLabel', '当前条件') }}
                </span>
                <StatusBadge
                  v-for="token in filteredMetrics.selectedFilters"
                  :key="token"
                  variant="primary"
                  outline
                >
                  {{ token }}
                </StatusBadge>
                <span v-if="!filteredMetrics.selectedFilters.length" class="text-sm text-(--text-secondary)">
                  {{ t('outboxOps.summary.noFilters', '未设置筛选条件') }}
                </span>
              </div>
            </SummaryStrip>
          </StatePanel>
        </div>
      </div>
    </template>

    <template #content>
      <div data-testid="outbox-workspace" class="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]">
        <StatePanel variant="panel" class="space-y-4">
          <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
                {{ t('outboxOps.workspace.queueLabel', '事件队列台') }}
              </p>
              <h2 class="mt-1 text-lg font-semibold text-(--text-main)">
                {{ t('outboxOps.workspace.queueTitle', '按事件和消费者定位异常链路') }}
              </h2>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <StatusBadge variant="info" outline>
                {{ t('outboxOps.workspace.results', { count: filteredMetrics.totalEvents }) }}
              </StatusBadge>
              <StatusBadge :variant="filteredMetrics.failedJobs ? 'danger' : 'success'" outline>
                {{ filteredMetrics.failedJobs
                  ? t('outboxOps.workspace.failedHint', { count: filteredMetrics.failedJobs })
                  : t('outboxOps.workspace.clearHint', '当前范围无失败项') }}
              </StatusBadge>
            </div>
          </div>

          <OutboxEventTable
            :events="events"
            :loading="loading"
            :selected-event-id="selectedEventId"
            @select="handleSelectEvent"
          />
        </StatePanel>

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
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useOutboxOps } from '@/composables/useOutboxOps';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';
import StatePanel from '@/design-system/composed/StatePanel.vue';
import SummaryStrip from '@/design-system/composed/SummaryStrip.vue';
import MetricTile from '@/design-system/composed/MetricTile.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/Select.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import OutboxEventTable from '@/components/outbox/OutboxEventTable.vue';
import OutboxReplayPanel from '@/components/outbox/OutboxReplayPanel.vue';
import { buildOutboxOpsMetrics } from '@/components/outbox/outboxOpsSummary';

const { t } = useI18n();
const healthOps = useOutboxOps();
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
const {
  events: healthEvents,
  loadEvents: loadHealthEvents,
} = healthOps;

const filters = reactive({
  eventType: '',
  consumerName: '',
  status: '',
});
const selectedEventId = ref('');

const statusOptions = computed(() => ([
  { value: '', label: t('outboxOps.filters.allStatuses', '全部状态') },
  { value: 'pending', label: 'pending' },
  { value: 'processing', label: 'processing' },
  { value: 'published', label: 'published' },
  { value: 'failed', label: 'failed' },
  { value: 'skipped', label: 'skipped' },
]));
const hasActiveFilters = computed(() => Boolean(
  filters.eventType || filters.consumerName || filters.status
));
const healthMetrics = computed(() => buildOutboxOpsMetrics(
  hasActiveFilters.value ? healthEvents.value : events.value
));
const filteredMetrics = computed(() => buildOutboxOpsMetrics(events.value, filters));

async function fetchEvents() {
  clearReplayResult();
  if (hasActiveFilters.value) {
    await loadEvents(filters);
    void loadHealthEvents({});
  } else {
    await loadEvents({});
  }

  if (selectedEventId.value && !events.value.some((event) => event.id === selectedEventId.value)) {
    selectedEventId.value = '';
    eventDetail.value = null;
  }
}

async function handleSelectEvent(event) {
  clearReplayResult();
  selectedEventId.value = event?.id || '';
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

function formatMetricValue(value) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

onMounted(() => {
  fetchEvents();
});
</script>
