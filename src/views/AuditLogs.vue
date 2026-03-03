<template>
  <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <AppFilterBar
      :title="t('auditLogs.title')"
    >
      <template #filters>
        <select
          v-model="filterAction"
          class="rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-2 text-sm text-(--text-primary) focus:border-primary focus:outline-none"
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppFilterBar from '@/components/ui/AppFilterBar.vue';
import AppTable from '@/components/ui/AppTable.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const { t } = useI18n();

const logs = ref([]);
const loading = ref(false);
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
