<template>
  <PermissionDeniedState
    v-if="errorCode === ErrorCode.FORBIDDEN"
    :title="t('auditLogs.permissionDenied')"
    :description="error || t('auditLogs.permissionDeniedDesc')"
    required-permission="audit:read"
    @retry="fetchLogs"
  />
  <div v-else-if="error" class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-8">
    <PermissionDeniedState
      :title="t('auditLogs.loadFailed')"
      :description="
        errorCode === ErrorCode.UNAUTHORIZED
          ? t('auditLogs.sessionExpired')
          : t('auditLogs.loadFailedDesc')
      "
      :reason="error"
      @retry="fetchLogs"
    />
  </div>
  <ManagementListShell v-else :title="t('auditLogs.title')" description="">
    <template #filters>
      <div class="grid gap-3 md:grid-cols-4">
        <AppSelect
          v-model="filterAction"
          :options="actionOptions"
          :placeholder="t('auditLogs.allActions')"
          size="sm"
        />
        <AppSelect
          v-model="filterResult"
          :options="resultOptions"
          :placeholder="t('auditLogs.allResults')"
          size="sm"
        />
        <AppSelect
          v-model="filterSeverity"
          :options="severityOptions"
          :placeholder="t('auditLogs.allSeverities')"
          size="sm"
        />
        <AppInput v-model="filterActor" :placeholder="t('auditLogs.user')" size="sm" />
      </div>
    </template>
    <template #actions>
      <AppButton variant="secondary" :text="t('common.refresh')" @click="fetchLogs" />
    </template>
    <template #content>
      <AppTable
        :columns="columns"
        :data="logs"
        :loading="loading"
        :empty-text="t('auditLogs.empty')"
        no-border
      >
        <template #cell-created_at="{ value }">
          <span class="text-xs text-(--text-secondary)">{{ formatDate(value) }}</span>
        </template>

        <template #cell-actor_display="{ value, row }">
          <span class="font-medium text-(--text-main)">{{ value }}</span>
          <div class="text-xs text-(--text-muted)">{{ row.actor_type || '-' }}</div>
        </template>

        <template #cell-action="{ row }">
          <StatusBadge :variant="actionBadgeVariant(row.action)" :title="row.action">
            {{ row.action_display }}
          </StatusBadge>
        </template>

        <template #cell-result="{ value }">
          <StatusBadge :variant="resultBadgeVariant(value)">
            {{ value }}
          </StatusBadge>
        </template>

        <template #cell-severity="{ value }">
          <StatusBadge :variant="severityBadgeVariant(value)">
            {{ value }}
          </StatusBadge>
        </template>

        <template #cell-target="{ row }">
          <span class="text-(--text-secondary)">
            {{ row.target_display }}
          </span>
        </template>

        <template #cell-summary_display="{ value }">
          <div class="max-w-sm text-sm text-(--text-main)">{{ value }}</div>
        </template>

        <template #cell-details="{ row }">
          <div class="max-w-xs truncate text-xs text-(--text-muted)">
            {{ row.details_display }}
          </div>
        </template>

        <template #footer>
          <div v-if="pagination.totalPages > 1" class="flex items-center justify-between">
            <span class="text-sm text-(--text-secondary)">
              {{
                t('auditLogs.pagination', { page: pagination.page, total: pagination.totalPages })
              }}
            </span>
            <div class="flex gap-2">
              <AppButton
                variant="secondary"
                :text="t('common.prev')"
                :disabled="pagination.page <= 1"
                @click="goPage(pagination.page - 1)"
              />
              <AppButton
                variant="secondary"
                :text="t('common.next')"
                :disabled="pagination.page >= pagination.totalPages"
                @click="goPage(pagination.page + 1)"
              />
            </div>
          </div>
        </template>
      </AppTable>
    </template>
  </ManagementListShell>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import AppButton from '@/components/ui/AppButton.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/Select.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';
import { formatAuditAction, normalizeAuditRow } from '@/utils/audit-log';
import { formatDate } from '@/utils/formatters';
import { classifyError, extractErrorMessage } from '@/utils/api-helpers';
import { ErrorCode } from '@/utils/error-codes';

const { t } = useI18n();
const { authFetch } = useAuth();

const logs = ref([]);
const loading = ref(false);
const error = ref('');
const errorCode = ref(null);
const filterAction = ref('');
const filterResult = ref('');
const filterSeverity = ref('');
const filterActor = ref('');
const availableActions = ref([]);
const pagination = ref({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
const actionOptions = computed(() => [
  { value: '', label: t('auditLogs.allActions') },
  ...availableActions.value.map((action) => ({ value: action, label: formatAuditAction(action) })),
]);
const resultOptions = computed(() => [
  { value: '', label: t('auditLogs.allResults') },
  { value: 'success', label: 'success' },
  { value: 'denied', label: 'denied' },
  { value: 'failed', label: 'failed' },
]);
const severityOptions = computed(() => [
  { value: '', label: t('auditLogs.allSeverities') },
  { value: 'normal', label: 'normal' },
  { value: 'high', label: 'high' },
  { value: 'critical', label: 'critical' },
]);

const columns = computed(() => [
  { key: 'created_at', label: t('auditLogs.time'), width: '120px' },
  { key: 'actor_display', label: t('auditLogs.user') },
  { key: 'action', label: t('auditLogs.action') },
  { key: 'result', label: t('auditLogs.result') },
  { key: 'severity', label: t('auditLogs.severity') },
  { key: 'target', label: t('auditLogs.target') },
  { key: 'summary_display', label: t('auditLogs.summary') },
  { key: 'details', label: t('auditLogs.details') },
]);

const actionBadgeVariant = (action) => {
  if (action?.includes('delete')) return 'danger';
  if (action?.includes('create')) return 'success';
  return 'primary';
};

const resultBadgeVariant = (result) => {
  if (result === 'failed') return 'danger';
  if (result === 'denied') return 'warning';
  return 'success';
};

const severityBadgeVariant = (severity) => {
  if (severity === 'critical') return 'danger';
  if (severity === 'high') return 'warning';
  return 'primary';
};

const fetchLogs = async () => {
  loading.value = true;
  error.value = '';
  errorCode.value = null;
  try {
    const params = new URLSearchParams({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    });
    if (filterAction.value) params.set('action', filterAction.value);
    if (filterResult.value) params.set('result', filterResult.value);
    if (filterSeverity.value) params.set('severity', filterSeverity.value);
    if (filterActor.value) params.set('actorId', filterActor.value);

    const res = await authFetch(`/api/manage/audit-logs?${params}`);
    const json = await res.json();
    if (json.success) {
      logs.value = (json.data || []).map((row) => normalizeAuditRow(row));
      pagination.value = json.pagination;
      return;
    }
    error.value = json.error || json.message || t('common.loadFailed');
  } catch (_err) {
    const code = classifyError(_err);
    errorCode.value = code;
    error.value = extractErrorMessage(_err, t('common.loadFailed'));
    console.error('[AuditLogs] fetch error', _err);
  } finally {
    loading.value = false;
  }
};

const fetchActions = async () => {
  try {
    const res = await authFetch('/api/manage/audit-logs/actions');
    const json = await res.json();
    if (json.success) availableActions.value = json.data;
  } catch (_err) {
    const status = Number(_err?.status || 0);
    // actions 为辅助筛选接口，403 不应覆盖主列表权限态并导致整页误封
    if (status === 401 || status === 403) {
      availableActions.value = [];
      return;
    }
    console.warn('[AuditLogs] fetch actions failed', _err);
  }
};

const goPage = (p) => {
  pagination.value.page = p;
  fetchLogs();
};

watch(filterAction, () => {
  pagination.value.page = 1;
  fetchLogs();
});

watch([filterResult, filterSeverity, filterActor], () => {
  pagination.value.page = 1;
  fetchLogs();
});

onMounted(() => {
  fetchLogs();
  fetchActions();
});
</script>
