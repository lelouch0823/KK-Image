<template>
  <div class="space-y-6">
    <!-- Webhook 列表 -->
    <SettingsSection
      :title="t('settings.webhooks.title', 'Webhook 管理')"
      :description="
        t(
          'settings.webhooks.description',
          '管理外部 Webhook 端点，系统事件将自动推送到已订阅的端点。'
        )
      "
      icon="globe-alt"
    >
      <div class="space-y-3">
        <div
          v-for="wh in webhooks"
          :key="wh.id"
          class="flex items-center justify-between rounded-xl border border-(--border-color) p-4"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate text-sm font-medium text-(--text-main)">{{ wh.url }}</p>
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                :class="
                  wh.enabled
                    ? 'bg-(--color-success-bg) text-(--color-success-text)'
                    : 'bg-(--bg-muted) text-(--text-muted)'
                "
              >
                {{ wh.enabled ? t('common.active') : t('settings.webhooks.disabled', '已禁用') }}
              </span>
            </div>
            <p class="mt-1 text-xs text-(--text-secondary)">
              {{ formatWebhookEventList(wh.events) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <AppButton
              variant="ghost"
              size="sm"
              :loading="testingId === wh.id"
              @click="testWebhook(wh.id)"
            >
              {{ t('settings.webhooks.test', '测试') }}
            </AppButton>
            <AppButton variant="ghost" size="sm" @click="viewLogs(wh.id)">
              {{ t('settings.webhooks.logs', '日志') }}
            </AppButton>
          </div>
        </div>

        <div v-if="webhooks.length === 0" class="py-8 text-center">
          <AppIcon name="globe-alt" class="mx-auto mb-2 size-8 text-(--text-tertiary)" />
          <p class="text-sm text-(--text-secondary)">
            {{ t('settings.webhooks.noWebhooks', '暂无 Webhook 配置') }}
          </p>
        </div>
      </div>
    </SettingsSection>

    <!-- 投递日志 -->
    <SettingsSection
      :title="t('settings.webhooks.deliveryLogs', '投递日志')"
      :description="
        t('settings.webhooks.deliveryLogsDesc', '查看 Webhook 投递记录，支持重试失败的投递。')
      "
      icon="document-text"
    >
      <template v-if="selectedWebhookId" #header-extra>
        <div class="flex items-center gap-2">
          <span class="text-xs text-(--text-secondary)">
            {{ t('settings.webhooks.filteringBy', '筛选') }}: {{ selectedWebhookId }}
          </span>
          <AppButton variant="ghost" size="sm" @click="clearFilter">
            {{ t('common.clearSearch') }}
          </AppButton>
        </div>
      </template>

      <!-- 筛选栏 -->
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <Select
          v-model="logFilter.success"
          :options="logFilterOptions"
          size="sm"
          @change="loadLogs"
        />
        <AppButton variant="ghost" size="sm" @click="loadLogs">
          <template #icon-left>
            <AppIcon name="arrow-path" class="size-4" />
          </template>
          {{ t('common.refresh') }}
        </AppButton>
      </div>

      <!-- 日志列表 -->
      <div v-if="logsLoading" class="flex items-center justify-center py-8">
        <div
          class="size-5 animate-spin rounded-full border-2 border-(--border-color) border-t-(--color-primary)"
        />
      </div>

      <div v-else-if="logs.length === 0" class="py-8 text-center">
        <p class="text-sm text-(--text-secondary)">{{ t('common.noData') }}</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="log in logs"
          :key="log.id"
          class="rounded-xl border border-(--border-color) p-3"
        >
          <div class="flex items-start justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="
                    log.success
                      ? 'bg-(--color-success-bg) text-(--color-success-text)'
                      : 'bg-(--color-danger-bg) text-(--color-danger-text)'
                  "
                >
                  {{ log.success ? '200 OK' : log.status_code || 'ERR' }}
                </span>
                <span class="text-xs text-(--text-secondary)">{{
                  formatDomainEventType(log.event)
                }}</span>
                <span v-if="log.duration_ms" class="text-xs text-(--text-tertiary)">
                  {{ log.duration_ms }}ms
                </span>
              </div>
              <p class="mt-1 text-xs text-(--text-tertiary)">
                {{ formatDate(log.created_at) }}
                <span v-if="log.attempt_number > 1" class="ml-2"> #{{ log.attempt_number }} </span>
              </p>
              <p
                v-if="log.response && !log.success"
                class="mt-1 truncate text-xs text-(--text-secondary)"
              >
                {{ log.response }}
              </p>
            </div>
            <AppButton
              v-if="!log.success"
              variant="ghost"
              size="sm"
              :loading="retryingLogId === log.id"
              @click="retryLog(log.id)"
            >
              <template #icon-left>
                <AppIcon name="arrow-path" class="size-4" />
              </template>
              {{ t('common.retry') }}
            </AppButton>
          </div>
        </div>

        <!-- 分页 -->
        <div v-if="logsTotal > logFilter.limit" class="flex items-center justify-between pt-2">
          <p class="text-xs text-(--text-secondary)">{{ t('common.total') }}: {{ logsTotal }}</p>
          <div class="flex items-center gap-2">
            <AppButton
              variant="ghost"
              size="sm"
              :disabled="logFilter.offset === 0"
              @click="
                logFilter.offset = Math.max(0, logFilter.offset - logFilter.limit);
                loadLogs();
              "
            >
              {{ t('common.prev') }}
            </AppButton>
            <AppButton
              variant="ghost"
              size="sm"
              :disabled="logFilter.offset + logFilter.limit >= logsTotal"
              @click="
                logFilter.offset += logFilter.limit;
                loadLogs();
              "
            >
              {{ t('common.next') }}
            </AppButton>
          </div>
        </div>
      </div>
    </SettingsSection>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import SettingsSection from '@/components/settings/SettingsSection.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Select from '@/components/ui/Select.vue';
import { formatDate } from '@/utils/formatters';
import { formatDomainEventType } from '@/utils/event-display';

const { t } = useI18n();
const { addToast } = useToast();
const { authFetch } = useAuth();

const webhooks = ref([]);
const logs = ref([]);
const logsTotal = ref(0);
const logsLoading = ref(false);
const testingId = ref(null);
const retryingLogId = ref(null);
const selectedWebhookId = ref(null);

const logFilter = ref({
  success: '',
  limit: 20,
  offset: 0,
});

const logFilterOptions = computed(() => [
  { value: '', label: t('settings.webhooks.allStatus', '全部状态') },
  { value: '1', label: t('settings.webhooks.success', '成功') },
  { value: '0', label: t('settings.webhooks.failed', '失败') },
]);

function formatWebhookEventList(events = []) {
  if (!events.length) return t('settings.webhooks.allEvents', '所有事件');
  return events.map((eventType) => formatDomainEventType(eventType)).join('、');
}

async function loadWebhooks() {
  try {
    const response = await authFetch('/api/manage/webhooks');
    const res = await response.json();
    if (res.success) {
      webhooks.value = res.data || [];
    }
  } catch (_err) {
    console.error('加载 Webhook 列表失败:', _err);
  }
}

async function loadLogs() {
  logsLoading.value = true;
  try {
    const params = new URLSearchParams();
    if (selectedWebhookId.value) {
      params.set('webhook_id', selectedWebhookId.value);
    }
    if (logFilter.value.success) {
      params.set('success', logFilter.value.success);
    }
    params.set('limit', String(logFilter.value.limit));
    params.set('offset', String(logFilter.value.offset));

    const response = await authFetch(`/api/manage/webhooks/logs?${params}`);
    const res = await response.json();
    if (res.success) {
      logs.value = res.data?.items || [];
      logsTotal.value = res.data?.total || 0;
    }
  } catch (_err) {
    console.error('加载投递日志失败:', _err);
  } finally {
    logsLoading.value = false;
  }
}

async function testWebhook(webhookId) {
  testingId.value = webhookId;
  try {
    const response = await authFetch(`/api/manage/webhooks/${webhookId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await response.json();
    if (res.success || res.data?.status) {
      addToast(
        t('settings.webhooks.testSuccess', '测试发送成功') +
          ` (${res.data?.status}, ${res.data?.duration}ms)`,
        'success'
      );
      await loadLogs();
    } else {
      addToast(t('settings.webhooks.testFailed', '测试发送失败'), 'error');
    }
  } catch (_err) {
    addToast(t('settings.webhooks.testFailed', '测试发送失败'), 'error');
  } finally {
    testingId.value = null;
  }
}

function viewLogs(webhookId) {
  selectedWebhookId.value = webhookId;
  logFilter.value.offset = 0;
  loadLogs();
}

function clearFilter() {
  selectedWebhookId.value = null;
  logFilter.value.offset = 0;
  loadLogs();
}

async function retryLog(logId) {
  retryingLogId.value = logId;
  try {
    const response = await authFetch(`/api/manage/webhooks/logs/${logId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await response.json();
    if (res.success) {
      addToast(t('settings.webhooks.retrySuccess', '重试发送成功'), 'success');
      await loadLogs();
    } else {
      addToast(t('settings.webhooks.retryFailed', '重试发送失败'), 'error');
    }
  } catch (_err) {
    addToast(t('settings.webhooks.retryFailed', '重试发送失败'), 'error');
  } finally {
    retryingLogId.value = null;
  }
}

onMounted(() => {
  loadWebhooks();
  loadLogs();
});
</script>
