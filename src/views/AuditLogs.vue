<template>
  <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <h1 class="mb-6 text-2xl font-bold text-[var(--text-primary)]">{{ t('auditLogs.title') }}</h1>

    <!-- 过滤器 -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <select
        v-model="filterAction"
        class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
      >
        <option value="">{{ t('auditLogs.allActions') }}</option>
        <option v-for="a in availableActions" :key="a" :value="a">{{ a }}</option>
      </select>
      <AppButton variant="secondary" :text="t('common.refresh')" @click="fetchLogs" />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="size-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent"></div>
    </div>

    <!-- 日志表格 -->
    <div v-else class="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-[var(--border-color)] bg-[var(--bg-muted)]">
          <tr>
            <th class="px-4 py-3 font-medium text-[var(--text-secondary)]">{{ t('auditLogs.time') }}</th>
            <th class="px-4 py-3 font-medium text-[var(--text-secondary)]">{{ t('auditLogs.user') }}</th>
            <th class="px-4 py-3 font-medium text-[var(--text-secondary)]">{{ t('auditLogs.action') }}</th>
            <th class="px-4 py-3 font-medium text-[var(--text-secondary)]">{{ t('auditLogs.target') }}</th>
            <th class="px-4 py-3 font-medium text-[var(--text-secondary)]">IP</th>
            <th class="px-4 py-3 font-medium text-[var(--text-secondary)]">{{ t('auditLogs.details') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-color)]">
          <tr v-for="log in logs" :key="log.id" class="transition-colors hover:bg-[var(--bg-muted)]">
            <td class="px-4 py-3 text-xs whitespace-nowrap text-[var(--text-secondary)]">
              {{ formatTime(log.created_at) }}
            </td>
            <td class="px-4 py-3 font-medium text-[var(--text-primary)]">{{ log.user_id }}</td>
            <td class="px-4 py-3">
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" :class="actionBadgeClass(log.action)">
                {{ log.action }}
              </span>
            </td>
            <td class="px-4 py-3 text-[var(--text-secondary)]">
              {{ log.target_type }}<span v-if="log.target_id" class="text-[var(--text-tertiary)]"> / {{ log.target_id.substring(0, 8) }}…</span>
            </td>
            <td class="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{{ log.ip_address || '-' }}</td>
            <td class="max-w-xs truncate px-4 py-3 text-xs text-[var(--text-tertiary)]">
              {{ log.payload ? JSON.parse(log.payload) : '-' }}
            </td>
          </tr>
          <tr v-if="logs.length === 0">
            <td colspan="6" class="py-8 text-center text-[var(--text-secondary)]">{{ t('auditLogs.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="pagination.totalPages > 1" class="mt-4 flex items-center justify-between">
      <span class="text-sm text-[var(--text-secondary)]">
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
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';

const { t } = useI18n();

const logs = ref([]);
const loading = ref(false);
const filterAction = ref('');
const availableActions = ref([]);
const pagination = ref({ page: 1, pageSize: 50, total: 0, totalPages: 1 });

const formatTime = (ts) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
};

const actionBadgeClass = (action) => {
  if (action?.includes('delete')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (action?.includes('create')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
};

const fetchLogs = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: pagination.value.page, pageSize: pagination.value.pageSize });
    if (filterAction.value) params.set('action', filterAction.value);

    const res = await fetch(`/api/manage/audit-logs?${params}`);
    const json = await res.json();
    if (json.success) {
      logs.value = json.data;
      pagination.value = json.pagination;
    }
  } catch (_err) {
    console.error('[AuditLogs] fetch error', _err);
  } finally {
    loading.value = false;
  }
};

const fetchActions = async () => {
  try {
    const res = await fetch('/api/manage/audit-logs/actions');
    const json = await res.json();
    if (json.success) availableActions.value = json.data;
  } catch (_err) { /* silent */ }
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
