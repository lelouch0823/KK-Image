<template>
  <ManagementListShell :title="t('erpSync.title')" :description="t('erpSync.connections')">
    <template #actions>
      <AppButton variant="primary" @click="openCreateModal">
        <template #icon-left>
          <AppIcon name="plus" class="size-4" />
        </template>
        {{ t('erpSync.addConnection') }}
      </AppButton>
    </template>

    <template #content>
      <!-- 加载状态 -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <AppIcon name="spinner" class="size-6 animate-spin text-(--text-muted)" />
        <span class="ml-2 text-(--text-muted)">{{ t('erpSync.loading') }}</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="connections.length === 0" class="flex flex-col items-center justify-center py-12">
        <AppIcon name="cloud-arrow-up" class="size-12 text-(--text-muted)" />
        <p class="mt-3 text-(--text-muted)">{{ t('erpSync.empty') }}</p>
      </div>

      <!-- 连接列表 -->
      <div v-else class="space-y-4">
        <div
          v-for="conn in connections"
          :key="conn.id"
          class="rounded-lg border border-(--border-color) bg-(--bg-card) p-4"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-medium text-(--text-main)">{{ conn.name }}</h3>
                <span
                  :class="[
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    conn.enabled
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                  ]"
                >
                  {{ conn.enabled ? t('erpSync.enabled') : t('erpSync.status') }}
                </span>
                <span class="rounded bg-(--bg-hover) px-1.5 py-0.5 text-xs text-(--text-muted)">
                  {{ t(`erpSync.adapter.${conn.adapterType}`, conn.adapterType) }}
                </span>
                <span class="rounded bg-(--bg-hover) px-1.5 py-0.5 text-xs text-(--text-muted)">
                  {{ t(`erpSync.direction.${conn.syncDirection}`, conn.syncDirection) }}
                </span>
              </div>
              <p class="mt-1 text-xs text-(--text-muted)">{{ conn.baseUrl }}</p>
              <div class="mt-2 flex items-center gap-4 text-xs text-(--text-muted)">
                <span v-if="conn.lastSyncAt">
                  {{ t('erpSync.lastSyncAt') }}: {{ formatTime(conn.lastSyncAt) }}
                </span>
                <span v-if="conn.lastSyncStatus" :class="syncStatusClass(conn.lastSyncStatus)">
                  {{ t(`erpSync.syncStatus.${conn.lastSyncStatus}`, conn.lastSyncStatus) }}
                </span>
                <span v-if="conn.lastError" class="text-red-500" :title="conn.lastError">
                  {{ t('erpSync.lastError') }}: {{ conn.lastError.slice(0, 60) }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <AppButton variant="outline" size="sm" :disabled="syncingId === conn.id" @click="testConnection(conn.id)">
                <template #icon-left>
                  <AppIcon :name="syncingId === conn.id ? 'spinner' : 'signal'" :class="['size-4', { 'animate-spin': syncingId === conn.id }]" />
                </template>
                {{ t('erpSync.actions.test') }}
              </AppButton>
              <AppButton variant="outline" size="sm" :disabled="syncingId === conn.id" @click="triggerSync(conn.id)">
                <template #icon-left>
                  <AppIcon :name="syncingId === conn.id ? 'spinner' : 'arrow-path'" :class="['size-4', { 'animate-spin': syncingId === conn.id }]" />
                </template>
                {{ t('erpSync.actions.sync') }}
              </AppButton>
              <AppButton variant="outline" size="sm" @click="openEditModal(conn)">
                <template #icon-left>
                  <AppIcon name="pencil" class="size-4" />
                </template>
              </AppButton>
              <AppButton variant="outline" size="sm" @click="viewLogs(conn.id)">
                <template #icon-left>
                  <AppIcon name="document-text" class="size-4" />
                </template>
              </AppButton>
              <AppButton variant="outline" size="sm" class="text-red-500" @click="deleteConnection(conn.id)">
                <template #icon-left>
                  <AppIcon name="trash" class="size-4" />
                </template>
              </AppButton>
            </div>
          </div>

          <!-- 同步统计 -->
          <div v-if="stats[conn.id]" class="mt-3 flex gap-4 border-t border-(--border-color) pt-3">
            <div class="text-xs">
              <span class="text-(--text-muted)">{{ t('erpSync.stats.total') }}:</span>
              <span class="ml-1 font-medium text-(--text-main)">{{ stats[conn.id].total }}</span>
            </div>
            <div class="text-xs">
              <span class="text-green-600">{{ t('erpSync.stats.success') }}:</span>
              <span class="ml-1 font-medium">{{ stats[conn.id].success }}</span>
            </div>
            <div class="text-xs">
              <span class="text-red-500">{{ t('erpSync.stats.failed') }}:</span>
              <span class="ml-1 font-medium">{{ stats[conn.id].failed }}</span>
            </div>
            <div class="text-xs">
              <span class="text-yellow-500">{{ t('erpSync.stats.pending') }}:</span>
              <span class="ml-1 font-medium">{{ stats[conn.id].pending }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 同步日志弹窗 -->
      <div v-if="showLogsModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showLogsModal = false">
        <div class="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg bg-(--bg-card) shadow-xl">
          <div class="flex items-center justify-between border-b border-(--border-color) px-4 py-3">
            <h2 class="text-sm font-medium text-(--text-main)">{{ t('erpSync.logs.title') }}</h2>
            <button class="text-(--text-muted) hover:text-(--text-main)" @click="showLogsModal = false">
              <AppIcon name="x-mark" class="size-5" />
            </button>
          </div>
          <div class="overflow-y-auto p-4" style="max-height: 60vh;">
            <table v-if="logs.length > 0" class="w-full text-sm">
              <thead>
                <tr class="border-b border-(--border-color) text-left text-xs text-(--text-muted)">
                  <th class="pb-2 pr-3">{{ t('erpSync.logs.entityType') }}</th>
                  <th class="pb-2 pr-3">{{ t('erpSync.logs.direction') }}</th>
                  <th class="pb-2 pr-3">{{ t('erpSync.logs.action') }}</th>
                  <th class="pb-2 pr-3">{{ t('erpSync.logs.status') }}</th>
                  <th class="pb-2 pr-3">{{ t('erpSync.logs.entityId') }}</th>
                  <th class="pb-2 pr-3">{{ t('erpSync.logs.error') }}</th>
                  <th class="pb-2">{{ t('erpSync.logs.createdAt') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in logs" :key="log.id" class="border-b border-(--border-color) last:border-0">
                  <td class="py-2 pr-3">{{ t(`erpSync.entity.${log.entityType}`, log.entityType) }}</td>
                  <td class="py-2 pr-3">{{ t(`erpSync.direction.${log.direction}`, log.direction) }}</td>
                  <td class="py-2 pr-3">{{ t(`erpSync.action.${log.action}`, log.action) }}</td>
                  <td class="py-2 pr-3">
                    <span :class="logStatusClass(log.status)">
                      {{ t(`erpSync.logStatus.${log.status}`, log.status) }}
                    </span>
                  </td>
                  <td class="py-2 pr-3 font-mono text-xs">{{ log.entityId || '-' }}</td>
                  <td class="py-2 pr-3 text-xs text-red-500">{{ log.errorMessage || '-' }}</td>
                  <td class="py-2 text-xs text-(--text-muted)">{{ formatTime(log.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="py-8 text-center text-(--text-muted)">{{ t('erpSync.logs.noData') }}</div>
          </div>
        </div>
      </div>

      <!-- 创建/编辑连接弹窗 -->
      <div v-if="showFormModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showFormModal = false">
        <div class="w-full max-w-lg rounded-lg bg-(--bg-card) shadow-xl">
          <div class="flex items-center justify-between border-b border-(--border-color) px-4 py-3">
            <h2 class="text-sm font-medium text-(--text-main)">
              {{ editingConnection ? t('erpSync.editConnection') : t('erpSync.addConnection') }}
            </h2>
            <button class="text-(--text-muted) hover:text-(--text-main)" @click="showFormModal = false">
              <AppIcon name="x-mark" class="size-5" />
            </button>
          </div>
          <div class="space-y-4 p-4">
            <div>
              <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('erpSync.name') }}</label>
              <input
                v-model="form.name"
                type="text"
                :placeholder="t('erpSync.form.namePlaceholder')"
                class="w-full rounded border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) focus:border-(--color-primary) focus:outline-none"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('erpSync.adapterType') }}</label>
              <select
                v-model="form.adapterType"
                class="w-full rounded border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) focus:border-(--color-primary) focus:outline-none"
              >
                <option value="generic">{{ t('erpSync.adapter.generic') }}</option>
                <option value="rest">{{ t('erpSync.adapter.rest') }}</option>
                <option value="kingdee">{{ t('erpSync.adapter.kingdee') }}</option>
                <option value="yonyou">{{ t('erpSync.adapter.yonyou') }}</option>
                <option value="sap">{{ t('erpSync.adapter.sap') }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('erpSync.baseUrl') }}</label>
              <input
                v-model="form.baseUrl"
                type="url"
                :placeholder="t('erpSync.form.baseUrlPlaceholder')"
                class="w-full rounded border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) focus:border-(--color-primary) focus:outline-none"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('erpSync.authType') }}</label>
              <select
                v-model="form.authType"
                class="w-full rounded border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) focus:border-(--color-primary) focus:outline-none"
              >
                <option value="api_key">{{ t('erpSync.auth.api_key') }}</option>
                <option value="basic">{{ t('erpSync.auth.basic') }}</option>
                <option value="oauth2">{{ t('erpSync.auth.oauth2') }}</option>
              </select>
            </div>
            <div v-if="form.authType === 'api_key'">
              <label class="mb-1 block text-xs font-medium text-(--text-muted)">API Key</label>
              <input
                v-model="form.credentials.apiKey"
                type="password"
                :placeholder="t('erpSync.form.apiKeyPlaceholder')"
                class="w-full rounded border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) focus:border-(--color-primary) focus:outline-none"
              />
            </div>
            <div v-if="form.authType === 'basic'" class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('erpSync.form.usernamePlaceholder') }}</label>
                <input
                  v-model="form.credentials.username"
                  type="text"
                  class="w-full rounded border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) focus:border-(--color-primary) focus:outline-none"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('erpSync.form.passwordPlaceholder') }}</label>
                <input
                  v-model="form.credentials.password"
                  type="password"
                  class="w-full rounded border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) focus:border-(--color-primary) focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('erpSync.syncDirection') }}</label>
              <select
                v-model="form.syncDirection"
                class="w-full rounded border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) focus:border-(--color-primary) focus:outline-none"
              >
                <option value="bidirectional">{{ t('erpSync.direction.bidirectional') }}</option>
                <option value="push">{{ t('erpSync.direction.push') }}</option>
                <option value="pull">{{ t('erpSync.direction.pull') }}</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-2 border-t border-(--border-color) px-4 py-3">
            <AppButton variant="outline" size="sm" @click="showFormModal = false">
              {{ t('erpSync.form.cancel') }}
            </AppButton>
            <AppButton variant="primary" size="sm" :disabled="saving" @click="saveConnection">
              <template #icon-left>
                <AppIcon v-if="saving" name="spinner" class="size-4 animate-spin" />
              </template>
              {{ t('erpSync.form.save') }}
            </AppButton>
          </div>
        </div>
      </div>
    </template>
  </ManagementListShell>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { request } from '@/utils/http-core';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { t } = useI18n();
const { addToast } = useToast();

const connections = ref([]);
const loading = ref(true);
const syncingId = ref(null);
const stats = ref({});
const logs = ref([]);
const showLogsModal = ref(false);
const showFormModal = ref(false);
const editingConnection = ref(null);
const saving = ref(false);

const form = ref({
  name: '',
  adapterType: 'generic',
  baseUrl: '',
  authType: 'api_key',
  credentials: { apiKey: '', username: '', password: '' },
  syncDirection: 'bidirectional',
});

function resetForm() {
  form.value = {
    name: '',
    adapterType: 'generic',
    baseUrl: '',
    authType: 'api_key',
    credentials: { apiKey: '', username: '', password: '' },
    syncDirection: 'bidirectional',
  };
  editingConnection.value = null;
}

function openCreateModal() {
  resetForm();
  showFormModal.value = true;
}

function openEditModal(conn) {
  editingConnection.value = conn;
  form.value = {
    name: conn.name,
    adapterType: conn.adapterType,
    baseUrl: conn.baseUrl,
    authType: conn.authType,
    credentials: { apiKey: '', username: '', password: '', ...conn.credentials },
    syncDirection: conn.syncDirection,
  };
  showFormModal.value = true;
}

async function loadConnections() {
  loading.value = true;
  try {
    const res = await request('/api/manage/erp-sync/connections');
    const data = await res.json();
    connections.value = data.data || [];
    // 加载每个连接的统计
    for (const conn of connections.value) {
      loadStats(conn.id);
    }
  } catch (err) {
    addToast({ type: 'error', message: err.message });
  } finally {
    loading.value = false;
  }
}

async function loadStats(connId) {
  try {
    const res = await request(`/api/manage/erp-sync/connections/${connId}/stats`);
    const data = await res.json();
    stats.value[connId] = data.data;
  } catch { /* 忽略统计加载失败 */ }
}

async function saveConnection() {
  saving.value = true;
  try {
    const body = { ...form.value };
    if (body.authType !== 'api_key') delete body.credentials.apiKey;
    if (body.authType !== 'basic') { delete body.credentials.username; delete body.credentials.password; }

    if (editingConnection.value) {
      await request(`/api/manage/erp-sync/connections/${editingConnection.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await request('/api/manage/erp-sync/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    showFormModal.value = false;
    addToast({ type: 'success', message: t('erpSync.form.save') });
    await loadConnections();
  } catch (err) {
    addToast({ type: 'error', message: err.message });
  } finally {
    saving.value = false;
  }
}

async function deleteConnection(id) {
  if (!confirm(t('erpSync.deleteConfirm'))) return;
  try {
    await request(`/api/manage/erp-sync/connections/${id}`, { method: 'DELETE' });
    addToast({ type: 'success', message: t('erpSync.deleteConnection') });
    await loadConnections();
  } catch (err) {
    addToast({ type: 'error', message: err.message });
  }
}

async function testConnection(id) {
  syncingId.value = id;
  try {
    const res = await request(`/api/manage/erp-sync/connections/${id}/test`, { method: 'POST' });
    const data = await res.json();
    if (data.data?.success) {
      addToast({ type: 'success', message: t('erpSync.actions.testSuccess') });
    } else {
      addToast({ type: 'error', message: data.data?.message || t('erpSync.actions.testFailed') });
    }
  } catch {
    addToast({ type: 'error', message: t('erpSync.actions.testFailed') });
  } finally {
    syncingId.value = null;
  }
}

async function triggerSync(id) {
  syncingId.value = id;
  try {
    const res = await request(`/api/manage/erp-sync/connections/${id}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.data?.status === 'success') {
      addToast({ type: 'success', message: t('erpSync.actions.syncSuccess') });
    } else {
      addToast({ type: 'warning', message: t('erpSync.actions.syncSuccess') });
    }
    await loadConnections();
  } catch {
    addToast({ type: 'error', message: t('erpSync.actions.syncFailed') });
  } finally {
    syncingId.value = null;
  }
}

async function viewLogs(connId) {
  try {
    const res = await request(`/api/manage/erp-sync/logs?connectionId=${connId}&limit=50`);
    const data = await res.json();
    logs.value = data.data || [];
    showLogsModal.value = true;
  } catch (err) {
    addToast({ type: 'error', message: err.message });
  }
}

function formatTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN');
}

function syncStatusClass(status) {
  if (status === 'success') return 'text-green-600';
  if (status === 'failed') return 'text-red-500';
  if (status === 'partial') return 'text-yellow-500';
  return 'text-(--text-muted)';
}

function logStatusClass(status) {
  if (status === 'success') return 'text-green-600';
  if (status === 'failed') return 'text-red-500';
  if (status === 'pending') return 'text-yellow-500';
  if (status === 'conflict') return 'text-orange-500';
  return 'text-(--text-muted)';
}

onMounted(loadConnections);
</script>
