<template>
  <div
    data-testid="outbox-replay-panel"
    class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-(--text-main)">{{ t('outboxOps.replay.title', '重放工作台') }}</h3>
        <p class="mt-1 text-sm text-(--text-secondary)">
          {{ t('outboxOps.replay.description', '先 dry-run，再决定是否执行 replay。') }}
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

    <div v-if="detailLoading" class="mt-4 text-sm text-(--text-secondary)">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="event" class="mt-4 space-y-4">
      <div class="rounded-xl bg-(--bg-muted)/60 p-3 text-sm">
        <div class="font-medium text-(--text-main)">{{ event.event_type || '-' }}</div>
        <div class="mt-1 text-(--text-secondary)">#{{ event.id }}</div>
      </div>

      <AppInput
        v-model="consumerName"
        :placeholder="t('outboxOps.replay.consumerPlaceholder', '可选：只重放指定 consumer')"
      />

      <div class="flex flex-wrap gap-2">
        <AppButton
          size="sm"
          variant="secondary"
          :loading="replayLoading"
          :disabled="!event"
          :text="t('outboxOps.replay.dryRun', 'Dry Run')"
          @click="emitReplay('dry-run')"
        />
        <AppButton
          size="sm"
          variant="primary"
          :loading="replayLoading"
          :disabled="!event"
          :text="t('outboxOps.replay.execute', '执行 Replay')"
          @click="emitReplay('execute')"
        />
      </div>

      <div v-if="lastReplayResult" class="rounded-xl border border-(--border-color) bg-(--bg-muted)/40 p-3 text-sm">
        <div class="font-medium text-(--text-main)">
          {{ t('outboxOps.replay.lastResult', '最近结果') }}
        </div>
        <pre class="mt-2 overflow-x-auto text-xs text-(--text-secondary)">{{ formattedReplayResult }}</pre>
      </div>
    </div>

    <div v-else class="mt-4 rounded-xl border border-dashed border-(--border-color) p-4 text-sm text-(--text-secondary)">
      {{ t('outboxOps.replay.empty', '从左侧选择一条 outbox 事件查看详情并发起 replay。') }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';

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

const formattedReplayResult = computed(() => JSON.stringify(props.lastReplayResult || {}, null, 2));

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
