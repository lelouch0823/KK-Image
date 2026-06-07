<template>
  <div
    data-testid="outbox-replay-panel"
    class="space-y-4 rounded-2xl border border-(--border-color) bg-(--bg-card) p-4 shadow-card"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-(--text-main)">
          {{ t('outboxOps.replay.title', '重放工作台') }}
        </h3>
        <p class="mt-1 text-sm text-(--text-secondary)">
          {{
            t(
              'outboxOps.replay.description',
              '先核对事件上下文，再 dry-run，最后决定是否执行 replay。'
            )
          }}
        </p>
      </div>
      <AppButton
        variant="secondary"
        size="sm"
        :text="t('common.refresh')"
        :disabled="!event || detailLoading"
        @click="$emit('refresh', event?.id)"
      />
    </div>

    <div v-if="detailLoading" class="text-sm text-(--text-secondary)">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="event" class="space-y-4">
      <section
        data-testid="outbox-selection-summary"
        class="space-y-4 rounded-2xl border border-(--border-color)/70 bg-(--bg-muted)/35 p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold tracking-[0.14em] text-(--text-muted) uppercase">
              {{ t('outboxOps.replay.selectedEvent', '当前事件') }}
            </p>
            <h4 class="mt-1 text-base font-semibold text-(--text-main)">
              {{ event.event_type || '-' }}
            </h4>
            <p class="mt-1 text-sm text-(--text-secondary)">#{{ event.id || '-' }}</p>
          </div>
          <StatusBadge :variant="eventStatusVariant" dot>
            {{ eventStatusLabel }}
          </StatusBadge>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl border border-(--border-color)/60 bg-(--bg-card) p-3">
            <div class="text-xs font-semibold tracking-[0.12em] text-(--text-muted) uppercase">
              {{ t('outboxOps.replay.aggregateId', '聚合 ID') }}
            </div>
            <div class="mt-2 text-sm font-medium text-(--text-main)">
              {{ event.aggregate_id || '-' }}
            </div>
          </div>
          <div class="rounded-2xl border border-(--border-color)/60 bg-(--bg-card) p-3">
            <div class="text-xs font-semibold tracking-[0.12em] text-(--text-muted) uppercase">
              {{ t('outboxOps.replay.consumerCount', '消费者数量') }}
            </div>
            <div class="mt-2 text-sm font-medium text-(--text-main)">{{ consumerJobs.length }}</div>
          </div>
          <div class="rounded-2xl border border-(--border-color)/60 bg-(--bg-card) p-3">
            <div class="text-xs font-semibold tracking-[0.12em] text-(--text-muted) uppercase">
              {{ t('outboxOps.replay.failedCount', '失败消费者') }}
            </div>
            <div class="mt-2 text-sm font-medium text-(--text-main)">{{ failedJobCount }}</div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <StatusBadge
            v-for="job in consumerJobs"
            :key="`${event.id}-${job.consumer_name}`"
            :variant="resolveVariant(job.status)"
            dot
          >
            {{ job.consumer_name }} · {{ job.status }}
          </StatusBadge>
          <span v-if="!consumerJobs.length" class="text-sm text-(--text-secondary)">
            {{ t('outboxOps.replay.noConsumers', '当前事件暂无消费者记录。') }}
          </span>
        </div>
      </section>

      <section
        data-testid="outbox-replay-actions"
        class="space-y-4 rounded-2xl border border-(--border-color)/70 bg-(--bg-card) p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 class="text-sm font-semibold text-(--text-main)">
              {{ t('outboxOps.replay.actionsTitle', 'Replay 操作') }}
            </h4>
            <p class="mt-1 text-sm text-(--text-secondary)">
              {{
                t(
                  'outboxOps.replay.actionsDescription',
                  '建议先限定 consumer 并执行 Dry Run，确认范围后再正式 replay。'
                )
              }}
            </p>
          </div>
          <StatusBadge variant="warning" outline>
            {{ t('outboxOps.replay.adminWarning', '执行 replay 需要管理员权限') }}
          </StatusBadge>
        </div>

        <AppInput
          v-model="consumerName"
          :label="t('outboxOps.replay.consumerLabel', '指定 Consumer')"
          :hint="t('outboxOps.replay.consumerHint', '留空表示重放当前事件的全部消费者。')"
          :placeholder="t('outboxOps.replay.consumerPlaceholder', '可选：只重放指定 consumer')"
        />

        <div
          class="rounded-2xl border border-warning/25 bg-warning/8 p-3 text-sm text-(--text-secondary)"
        >
          <div class="flex items-start gap-2">
            <AppIcon name="information-circle" class="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              {{
                t(
                  'outboxOps.replay.riskNote',
                  'Dry Run 只验证命中范围和执行摘要；执行 Replay 前请确认事件、consumer 和最近结果都符合预期。'
                )
              }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <AppButton
            size="sm"
            variant="secondary"
            :loading="replayLoading"
            :disabled="!event"
            :text="t('outboxOps.replay.dryRun', 'Dry Run')"
            @click="emitReplay('dry-run')"
          >
            <template #icon-left>
              <AppIcon name="beaker" class="size-4" />
            </template>
          </AppButton>
          <AppButton
            size="sm"
            variant="primary"
            :loading="replayLoading"
            :disabled="!event"
            :text="t('outboxOps.replay.execute', '执行 Replay')"
            @click="emitReplay('execute')"
          >
            <template #icon-left>
              <AppIcon name="arrow-path" class="size-4" />
            </template>
          </AppButton>
        </div>
      </section>

      <section
        data-testid="outbox-replay-result"
        class="space-y-3 rounded-2xl border border-(--border-color)/70 bg-(--bg-card) p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 class="text-sm font-semibold text-(--text-main)">
              {{ t('outboxOps.replay.lastResultTitle', '最近一次操作结果') }}
            </h4>
            <p class="mt-1 text-sm text-(--text-secondary)">
              {{
                t(
                  'outboxOps.replay.lastResultDescription',
                  '这里展示本页最近一次 dry-run 或 replay 返回的摘要，不代表系统实时状态。'
                )
              }}
            </p>
          </div>
          <StatusBadge v-if="lastReplayResult" :variant="resultVariant" dot>
            {{ resultLabel }}
          </StatusBadge>
        </div>

        <div
          v-if="lastReplayResult"
          class="overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-page)"
        >
          <pre class="max-h-72 overflow-x-auto overflow-y-auto p-4 text-xs text-(--text-main)">{{
            formattedReplayResult
          }}</pre>
        </div>
        <div
          v-else
          class="rounded-2xl border border-dashed border-(--border-color) p-4 text-sm text-(--text-secondary)"
        >
          {{
            t('outboxOps.replay.resultEmpty', '尚未执行 Dry Run 或 Replay，最近结果会展示在这里。')
          }}
        </div>
      </section>
    </div>

    <div
      v-else
      class="rounded-2xl border border-dashed border-(--border-color) bg-(--bg-muted)/20 p-5 text-sm text-(--text-secondary)"
    >
      <div class="flex items-start gap-3">
        <div class="flex size-10 items-center justify-center rounded-xl bg-(--bg-muted)">
          <AppIcon name="sparkles" class="size-5 text-(--text-muted)" />
        </div>
        <div class="space-y-2">
          <div class="font-medium text-(--text-main)">
            {{ t('outboxOps.replay.emptyTitle', '先从左侧选择事件') }}
          </div>
          <p>
            {{
              t(
                'outboxOps.replay.empty',
                '选中事件后，这里会显示消费者状态、Replay 范围、操作按钮和最近结果。'
              )
            }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { resolveVariant } from '@/utils/outbox-status';

const props = defineProps({
  event: {
    type: Object,
    default: null,
  },
  detailLoading: {
    type: Boolean,
    default: false,
  },
  replayLoading: {
    type: Boolean,
    default: false,
  },
  lastReplayResult: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['refresh', 'dry-run', 'execute']);
const { t } = useI18n();
const consumerName = ref('');

watch(
  () => props.event?.id,
  () => {
    consumerName.value = '';
  }
);

const consumerJobs = computed(() => props.event?.consumerJobs || []);
const failedJobCount = computed(
  () => consumerJobs.value.filter((job) => job.status === 'failed').length
);
const activeJobCount = computed(
  () =>
    consumerJobs.value.filter((job) => job.status === 'pending' || job.status === 'processing')
      .length
);
const formattedReplayResult = computed(() => JSON.stringify(props.lastReplayResult || {}, null, 2));
const eventStatusVariant = computed(() => {
  if (failedJobCount.value) return 'danger';
  if (activeJobCount.value) return 'warning';
  return 'success';
});
const eventStatusLabel = computed(() => {
  if (failedJobCount.value)
    return t('outboxOps.replay.statusFailed', { count: failedJobCount.value });
  if (activeJobCount.value)
    return t('outboxOps.replay.statusActive', { count: activeJobCount.value });
  return t('outboxOps.replay.statusReady', '当前事件无失败消费者');
});
const resultVariant = computed(() => {
  if (!props.lastReplayResult) return 'default';
  if (props.lastReplayResult?.status === 'failed' || props.lastReplayResult?.error) return 'danger';
  if (props.lastReplayResult?.dryRun || props.lastReplayResult?.dry_run) return 'warning';
  return 'success';
});
const resultLabel = computed(() => {
  if (props.lastReplayResult?.status === 'failed' || props.lastReplayResult?.error) {
    return t('outboxOps.replay.resultFailed', '最近一次执行失败');
  }
  if (props.lastReplayResult?.dryRun || props.lastReplayResult?.dry_run) {
    return t('outboxOps.replay.resultDryRun', '最近一次为 Dry Run');
  }
  return t('outboxOps.replay.resultSuccess', '最近一次执行已完成');
});

function emitReplay(type) {
  if (!props.event?.id) return;
  const payload = {
    scopeType: 'event',
    scopeId: props.event.id,
    consumerName: consumerName.value.trim() || null,
  };

  if (type === 'dry-run') {
    emit('dry-run', payload);
    return;
  }

  emit('execute', payload);
}
</script>
