<template>
  <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div v-if="errorCode === 'FORBIDDEN'" class="rounded-xl border border-(--border-color) bg-(--bg-card) p-8">
      <PermissionDeniedState
        title="审计日志权限不足"
        :description="error || '当前账号没有审计日志读取权限，请联系管理员分配 audit_logs:read。'"
        required-permission="admin:full"
        @retry="fetchLogs"
      />
    </div>
    <div v-else-if="error" class="rounded-xl border border-(--border-color) bg-(--bg-card) p-8">
      <PermissionDeniedState
        title="审计日志加载失败"
        :description="errorCode === 'UNAUTHORIZED' ? '登录状态失效，请重新登录后重试。' : '请求失败，请检查网络后重试。'"
        :reason="error"
        @retry="fetchLogs"
      />
    </div>
    <template v-else>
    <AppFilterBar
      :title="t('auditLogs.title')"
    >
      <template #filters>
        <select
          v-model="filterAction"
          class="focus:border-primary focus:outline-none rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-2 text-sm text-(--text-primary)"
        >
          <option value="">{{ t('auditLogs.allActions') }}</option>
          <option v-for="a in availableActions" :key="a" :value="a">{{ a }}</option>
        </select>
      </template>
      <template #actions>
        <AppButton variant="secondary" :text="t('common.refresh')" @click="fetchLogs" />
      </template>
    </AppFilterBar>

    <div class="mt-4">
      <AppTable
        :columns="columns"
        :data="logs"
        :loading="loading"
        :empty-text="t('auditLogs.empty')"
      >
        <template #cell-created_at="{ value }">
          <span class="text-xs text-(--text-secondary)">{{ formatTime(value) }}</span>
        </template>
        
        <template #cell-user_id="{ value }">
          <span class="font-medium text-(--text-primary)">{{ value }}</span>
        </template>
        
        <template #cell-action="{ value }">
          <StatusBadge :variant="actionBadgeVariant(value)">
            {{ value }}
          </StatusBadge>
        </template>

        <template #cell-target="{ row }">
          <span class="text-(--text-secondary)">
            {{ row.target_type }}<span v-if="row.target_id" class="text-(--text-tertiary)"> / {{ row.target_id.substring(0, 8) }}…</span>
          </span>
        </template>
        
        <template #cell-ip_address="{ value }">
          <span class="font-mono text-xs text-(--text-secondary)">{{ value || '-' }}</span>
        </template>
        
        <template #cell-details="{ row }">
          <div class="max-w-xs truncate text-xs text-(--text-tertiary)">
            {{ row.payload ? JSON.parse(row.payload) : '-' }}
          </div>
        </template>
        
        <template #footer>
          <div v-if="pagination.totalPages > 1" class="flex items-center justify-between">
            <span class="text-sm text-(--text-secondary)">
              {{ t('auditLogs.pagination', { page: pagination.page, total: pagination.totalPages }) }}
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
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import AppButton from '@/components/ui/AppButton.vue';
import AppFilterBar from '@/components/ui/AppFilterBar.vue';
import AppTable from '@/components/ui/AppTable.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';

const { t } = useI18n();
const { authFetch } = useAuth();

const logs = ref([]);
const loading = ref(false);
const error = ref('');
const errorCode = ref(null);
const filterAction = ref('');
const availableActions = ref([]);
const pagination = ref({ page: 1, pageSize: 50, total: 0, totalPages: 1 });

const columns = computed(() => [
  { key: 'created_at', label: t('auditLogs.time'), width: '120px' },
  { key: 'user_id', label: t('auditLogs.user') },
  { key: 'action', label: t('auditLogs.action') },
  { key: 'target', label: t('auditLogs.target') },
  { key: 'ip_address', label: 'IP' },
  { key: 'details', label: t('auditLogs.details') },
]);

const formatTime = (ts) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
};

const actionBadgeVariant = (action) => {
  if (action?.includes('delete')) return 'danger';
  if (action?.includes('create')) return 'success';
  return 'primary';
};

const fetchLogs = async () => {
  loading.value = true;
  error.value = '';
  errorCode.value = null;
  try {
    const params = new URLSearchParams({ page: pagination.value.page, pageSize: pagination.value.pageSize });
    if (filterAction.value) params.set('action', filterAction.value);

    const res = await authFetch(`/api/manage/audit-logs?${params}`);
    const json = await res.json();
    if (json.success) {
      logs.value = json.data;
      pagination.value = json.pagination;
      return;
    }
    error.value = json.error || json.message || t('common.loadFailed');
  } catch (_err) {
    const status = Number(_err?.status || 0);
    if (status === 403) {
      errorCode.value = 'FORBIDDEN';
      error.value = _err?.data?.error || _err?.message || '权限不足';
      return;
    }
    if (status === 401) {
      errorCode.value = 'UNAUTHORIZED';
      error.value = _err?.data?.error || _err?.message || '未授权';
      return;
    }
    errorCode.value = 'NETWORK_ERROR';
    error.value = _err?.message || t('common.loadFailed');
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

onMounted(() => {
  fetchLogs();
  fetchActions();
});
</script>
