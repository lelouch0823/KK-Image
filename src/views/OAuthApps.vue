<template>
  <ManagementListShell :title="t('oauth.title')" :description="t('oauth.apps')">
    <template #actions>
      <AppButton variant="primary" @click="openCreateModal">
        <template #icon-left>
          <AppIcon name="plus" class="size-4" />
        </template>
        {{ t('oauth.addApp') }}
      </AppButton>
    </template>

    <template #content>
      <!-- 加载状态 -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <AppIcon name="spinner" class="size-6 animate-spin text-(--text-muted)" />
        <span class="ml-2 text-(--text-muted)">{{ t('oauth.loading') }}</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="clients.length === 0" class="flex flex-col items-center justify-center py-12">
        <AppIcon name="key" class="size-12 text-(--text-muted)" />
        <p class="mt-3 text-(--text-muted)">{{ t('oauth.empty') }}</p>
      </div>

      <!-- 应用列表 -->
      <div v-else class="space-y-4">
        <div
          v-for="client in clients"
          :key="client.id"
          class="rounded-lg border border-(--border-color) bg-(--bg-card) p-4"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-medium text-(--text-main)">{{ client.name }}</h3>
                <span
                  :class="[
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    client.enabled
                      ? 'bg-success/10 text-success'
                      : 'bg-(--color-muted-bg) text-(--text-muted)',
                  ]"
                >
                  {{ client.enabled ? t('oauth.enabled') : t('oauth.enabled') }}
                </span>
              </div>
              <p v-if="client.description" class="mt-1 text-xs text-(--text-muted)">{{ client.description }}</p>
              <div class="mt-2 space-y-1">
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-(--text-muted)">{{ t('oauth.clientId') }}:</span>
                  <code class="rounded bg-(--bg-hover) px-1.5 py-0.5 font-mono text-(--text-main)">{{ client.clientId }}</code>
                  <AppButton variant="ghost" size="sm" class="!size-6 !p-0" :title="t('oauth.copySuccess')" @click="copyToClipboard(client.clientId)">
                    <template #icon-left>
                      <AppIcon name="clipboard" class="size-3" />
                    </template>
                  </AppButton>
                </div>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="uri in client.redirectUris"
                    :key="uri"
                    class="rounded bg-(--bg-hover) px-1.5 py-0.5 text-xs text-(--text-muted)"
                  >
                    {{ uri }}
                  </span>
                </div>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="scope in client.scopes"
                    :key="scope"
                    class="rounded bg-info/10 px-1.5 py-0.5 text-xs text-info"
                  >
                    {{ scope }}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <AppButton variant="outline" size="sm" @click="openEditModal(client)">
                <template #icon-left>
                  <AppIcon name="pencil" class="size-4" />
                </template>
              </AppButton>
              <AppButton variant="outline" size="sm" @click="viewTokens(client)">
                <template #icon-left>
                  <AppIcon name="key" class="size-4" />
                </template>
                {{ t('oauth.actions.viewTokens') }}
              </AppButton>
              <AppButton variant="outline" size="sm" class="text-danger" @click="deleteClient(client.id)">
                <template #icon-left>
                  <AppIcon name="trash" class="size-4" />
                </template>
              </AppButton>
            </div>
          </div>
        </div>
      </div>

      <!-- 令牌弹窗 -->
      <Modal v-model="showTokensModal" :title="t('oauth.tokens.title')" size="2xl">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-(--text-main)">{{ t('oauth.tokens.title') }}</h3>
            <AppButton variant="outline" size="sm" class="text-danger" @click="revokeAllTokens">
              {{ t('oauth.actions.revokeTokens') }}
            </AppButton>
          </div>
        </template>
        <table v-if="tokens.length > 0" class="w-full text-sm">
          <thead>
            <tr class="border-b border-(--border-color) text-left text-xs text-(--text-muted)">
              <th class="pb-2 pr-3">{{ t('oauth.tokens.accessToken') }}</th>
              <th class="pb-2 pr-3">{{ t('oauth.tokens.scopes') }}</th>
              <th class="pb-2 pr-3">{{ t('oauth.tokens.expiresAt') }}</th>
              <th class="pb-2">{{ t('oauth.tokens.createdAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="token in tokens" :key="token.id" class="border-b border-(--border-color) last:border-0">
              <td class="py-2 pr-3 font-mono text-xs">{{ token.accessToken.slice(0, 20) }}...</td>
              <td class="py-2 pr-3">
                <span v-for="s in token.scopes" :key="s" class="mr-1 rounded bg-info/10 px-1 text-xs text-info">
                  {{ s }}
                </span>
              </td>
              <td class="py-2 pr-3 text-xs">{{ formatTime(token.expiresAt) }}</td>
              <td class="py-2 text-xs text-(--text-muted)">{{ formatTime(token.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="py-8 text-center text-(--text-muted)">{{ t('oauth.tokens.noData') }}</div>
      </Modal>

      <!-- 创建/编辑应用弹窗 -->
      <Modal v-model="showFormModal" :title="editingClient ? t('oauth.editApp') : t('oauth.addApp')" size="lg">
        <div class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('oauth.name') }}</label>
            <AppInput
              v-model="form.name"
              type="text"
              :placeholder="t('oauth.form.namePlaceholder')"
              size="sm"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('oauth.description') }}</label>
            <AppInput
              v-model="form.description"
              type="text"
              :placeholder="t('oauth.form.descriptionPlaceholder')"
              size="sm"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('oauth.redirectUris') }}</label>
            <div class="space-y-1">
              <div v-for="(uri, idx) in form.redirectUris" :key="idx" class="flex items-center gap-2">
                <AppInput
                  v-model="form.redirectUris[idx]"
                  type="url"
                  class="flex-1"
                  size="sm"
                />
                <AppButton variant="ghost" size="sm" class="!size-6 !p-0 text-danger hover:text-danger" @click="form.redirectUris.splice(idx, 1)">
                  <template #icon-left>
                    <AppIcon name="x-mark" class="size-4" />
                  </template>
                </AppButton>
              </div>
              <AppButton variant="ghost" size="sm" class="!h-auto !p-0 text-xs text-(--color-primary) hover:underline" @click="form.redirectUris.push('')">
                + {{ t('oauth.redirectUris') }}
              </AppButton>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-(--text-muted)">{{ t('oauth.scopes') }}</label>
            <div class="flex flex-wrap gap-2">
              <label v-for="scope in availableScopes" :key="scope" class="flex items-center gap-1 text-sm text-(--text-main)">
                <input v-model="form.scopes" type="checkbox" :value="scope" class="rounded" />
                {{ scope }}
              </label>
            </div>
          </div>
        </div>

        <!-- 创建成功后显示密钥 -->
        <div v-if="createdSecret" class="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <p class="text-xs font-medium text-warning">{{ t('oauth.secretWarning') }}</p>
          <div class="mt-2 flex items-center gap-2">
            <code class="flex-1 rounded bg-(--bg-hover) px-2 py-1 font-mono text-xs text-(--text-main)">{{ createdSecret }}</code>
            <AppButton variant="ghost" size="sm" class="!size-8 !p-0" :title="t('oauth.copySuccess')" @click="copyToClipboard(createdSecret)">
              <template #icon-left>
                <AppIcon name="clipboard" class="size-4" />
              </template>
            </AppButton>
          </div>
        </div>

        <template #footer>
          <AppButton variant="outline" size="sm" @click="showFormModal = false">
            {{ t('oauth.form.cancel') }}
          </AppButton>
          <AppButton v-if="!createdSecret" variant="primary" size="sm" :disabled="saving" @click="saveClient">
            <template #icon-left>
              <AppIcon v-if="saving" name="spinner" class="size-4 animate-spin" />
            </template>
            {{ t('oauth.form.save') }}
          </AppButton>
        </template>
      </Modal>

      <!-- 删除确认弹窗 -->
      <ConfirmDialog
        v-model="showDeleteConfirm"
        type="danger"
        :title="t('oauth.deleteApp')"
        :message="t('oauth.deleteConfirm')"
        :confirm-text="t('common.confirm')"
        @confirm="confirmDelete"
      />

      <!-- 撤销令牌确认弹窗 -->
      <ConfirmDialog
        v-model="showRevokeConfirm"
        type="warning"
        :title="t('oauth.actions.revokeTokens')"
        :message="t('oauth.actions.revokeTokensConfirm')"
        :confirm-text="t('common.confirm')"
        @confirm="confirmRevoke"
      />
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
import AppInput from '@/components/ui/AppInput.vue';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const { t } = useI18n();
const { addToast } = useToast();

const clients = ref([]);
const loading = ref(true);
const tokens = ref([]);
const showTokensModal = ref(false);
const showFormModal = ref(false);
const editingClient = ref(null);
const selectedClientId = ref(null);
const saving = ref(false);
const createdSecret = ref(null);
const showDeleteConfirm = ref(false);
const deleteTargetId = ref(null);
const showRevokeConfirm = ref(false);

const availableScopes = ['read', 'write', 'admin'];

const form = ref({
  name: '',
  description: '',
  redirectUris: [''],
  scopes: ['read'],
});

function resetForm() {
  form.value = {
    name: '',
    description: '',
    redirectUris: [''],
    scopes: ['read'],
  };
  editingClient.value = null;
  createdSecret.value = null;
}

function openCreateModal() {
  resetForm();
  showFormModal.value = true;
}

function openEditModal(client) {
  editingClient.value = client;
  createdSecret.value = null;
  form.value = {
    name: client.name,
    description: client.description || '',
    redirectUris: [...client.redirectUris],
    scopes: [...client.scopes],
  };
  showFormModal.value = true;
}

async function loadClients() {
  loading.value = true;
  try {
    const res = await request('/api/manage/oauth/apps');
    const data = await res.json();
    clients.value = data.data || [];
  } catch (err) {
    addToast({ type: 'error', message: err.message });
  } finally {
    loading.value = false;
  }
}

async function saveClient() {
  if (!form.value.name.trim()) return;
  const validUris = form.value.redirectUris.filter(u => u.trim());
  if (validUris.length === 0) {
    addToast({ type: 'error', message: t('oauth.redirectUris') });
    return;
  }

  saving.value = true;
  try {
    const body = {
      name: form.value.name,
      description: form.value.description || undefined,
      redirectUris: validUris,
      scopes: form.value.scopes,
    };

    if (editingClient.value) {
      await request(`/api/manage/oauth/apps/${editingClient.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      showFormModal.value = false;
      addToast({ type: 'success', message: t('oauth.form.save') });
    } else {
      const res = await request('/api/manage/oauth/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.data?.clientSecret) {
        createdSecret.value = data.data.clientSecret;
      } else {
        showFormModal.value = false;
      }
      addToast({ type: 'success', message: t('oauth.addApp') });
    }
    await loadClients();
  } catch (err) {
    addToast({ type: 'error', message: err.message });
  } finally {
    saving.value = false;
  }
}

function deleteClient(id) {
  deleteTargetId.value = id;
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  if (!deleteTargetId.value) return;
  try {
    await request(`/api/manage/oauth/apps/${deleteTargetId.value}`, { method: 'DELETE' });
    addToast({ type: 'success', message: t('oauth.deleteApp') });
    showDeleteConfirm.value = false;
    deleteTargetId.value = null;
    await loadClients();
  } catch (err) {
    addToast({ type: 'error', message: err.message });
  }
}

async function viewTokens(client) {
  selectedClientId.value = client.id;
  try {
    const res = await request(`/api/manage/oauth/apps/${client.id}/tokens`);
    const data = await res.json();
    tokens.value = data.data || [];
    showTokensModal.value = true;
  } catch (err) {
    addToast({ type: 'error', message: err.message });
  }
}

function revokeAllTokens() {
  showRevokeConfirm.value = true;
}

async function confirmRevoke() {
  try {
    await request(`/api/manage/oauth/apps/${selectedClientId.value}/revoke-tokens`, { method: 'POST' });
    addToast({ type: 'success', message: t('oauth.actions.tokensRevoked') });
    showRevokeConfirm.value = false;
    tokens.value = [];
  } catch (err) {
    addToast({ type: 'error', message: err.message });
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    addToast({ type: 'success', message: t('oauth.copySuccess') });
  });
}

function formatTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN');
}

onMounted(loadClients);
</script>
