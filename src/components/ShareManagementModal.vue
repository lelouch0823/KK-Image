<template>
  <Modal
    :model-value="modelValue"
    :title="t('share.management')"
    size="full"
    body-class="flex-1 overflow-auto p-6 flex flex-col h-[80vh]"
    @update:model-value="close"
  >
    <!-- Content -->
    <div class="flex-1">
      <!-- Desktop Table -->
      <div class="hidden lg:block">
        <table class="w-full text-left text-sm">
          <thead
            class="text-secondary sticky top-0 border-b border-[var(--border-color)] bg-[var(--bg-muted)]"
          >
            <tr>
              <th class="px-6 py-3 font-medium">{{ t('share.folderName') }}</th>
              <th class="px-6 py-3 font-medium">{{ t('share.linkToken') }}</th>
              <th class="px-6 py-3 font-medium">{{ t('share.expiry') }}</th>
              <th class="px-6 py-3 text-right font-medium">{{ t('share.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-color)]">
            <tr v-for="item in shares" :key="item.id" class="transition-colors hover:bg-[var(--bg-hover)]">
              <td class="text-primary px-6 py-3 font-medium">{{ item.name }}</td>
              <td class="text-secondary px-6 py-3">
                <div class="flex items-center gap-2">
                  <span class="rounded bg-[var(--bg-muted)] px-2 py-1 font-mono text-xs select-all">{{
                    item.shareToken
                  }}</span>
                  <button
                    class="text-primary hover:text-blue-600"
                    :title="t('share.copyLink') || '复制链接'"
                    @click="copyLink(item)"
                  >
                    <AppIcon name="clipboard" class="size-4" />
                  </button>
                </div>
              </td>
              <td class="px-6 py-3">
                <span :class="getExpiryClass(item.expiresAt)">{{ formatExpiry(item.expiresAt, t) }}</span>
              </td>
              <td class="px-6 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <AppButton
                    variant="secondary"
                    size="sm"
                    class="!size-8  bg-[var(--bg-card)] !p-1.5"
                    @click="editShare(item)"
                  >
                    <template #icon-left>
                      <AppIcon name="pencil-alt" class="size-4" />
                    </template>
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    size="sm"
                    class="!size-8  bg-[var(--bg-card)] !p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                    @click="revokeShare(item)"
                  >
                    <template #icon-left>
                      <AppIcon name="trash" class="size-4" />
                    </template>
                  </AppButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Table -->
      <div v-if="shares.length > 0" class="flex-1 overflow-hidden lg:hidden">
        <AppTable
            :columns="columns"
            :data="shares"
            :loading="loading"
        >
            <template #cell-name="{ row }">
                <div class="flex flex-col">
                    <span class="font-medium text-[var(--text-main)]">{{ row.name }}</span>
                    <span class="text-xs text-[var(--text-secondary)]">{{ row.spaceName }}</span>
                </div>
            </template>
            <template #cell-code="{ row }">
                <button
                    class="font-mono text-xs text-[var(--color-primary)] hover:underline"
                    @click="copyLink(row)"
                >
                    {{ row.shareToken }}
                </button>
            </template>
            <template #cell-expiresAt="{ row }">
                 <span :class="isExpired(row.expiresAt) ? 'text-[var(--color-danger)]' : 'text-[var(--text-secondary)]'">
                    {{ formatExpiry(row.expiresAt, t) }}
                 </span>
            </template>
            <template #cell-actions="{ row }">
                <div class="flex justify-end gap-2">
                    <AppButton
                        variant="ghost"
                        size="sm"
                        class="text-[var(--text-secondary)] hover:text-[var(--color-primary)]"
                        :title="t('share.copyLink')"
                        @click="copyLink(row)"
                    >
                        <template #icon-left>
                            <AppIcon name="clipboard" class="size-4" />
                        </template>
                    </AppButton>
                    <AppButton
                        variant="ghost"
                        size="sm"
                        class="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                        :title="t('common.cancelShare')"
                        @click="confirmRevoke(row)"
                    >
                        <template #icon-left>
                            <AppIcon name="trash" class="size-4" />
                        </template>
                    </AppButton>
                </div>
            </template>
        </AppTable>
    </div>
    <div v-else-if="!loading" class="flex flex-1 flex-col items-center justify-center text-[var(--text-secondary)]">
      <AppIcon name="share" class="mb-3 size-12 opacity-20" />
      <p>{{ t('share.noActiveShares') }}</p>
    </div>
    </div>

    <!-- Footer / Pagination -->
    <template #footer>
      <div class="flex flex-1 items-center justify-between">
        <span class="text-secondary text-sm">{{ t('share.total', { count: total }) }}</span>
        <div class="flex gap-2">
          <button
            :disabled="page <= 1"
            class="btn btn-secondary px-3 py-1 text-sm disabled:opacity-50"
            @click="page--"
          >
            {{ t('share.prevPage') }}
          </button>
          <span class="text-secondary flex items-center px-2 text-sm"
            >{{ page }} / {{ totalPages }}</span
          >
          <button
            :disabled="page >= totalPages"
            class="btn btn-secondary px-3 py-1 text-sm disabled:opacity-50"
            @click="page++"
          >
            {{ t('share.nextPage') }}
          </button>
        </div>
      </div>
    </template>
  </Modal>

  <!-- Confirm Dialog -->
  <ConfirmDialog
    v-model="confirmData.show"
    :title="confirmData.title"
    :message="confirmData.message"
    :type="confirmData.type"
    :loading="confirmData.loading"
    @confirm="confirmData.onConfirm"
  />
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useClipboard } from '@/composables/useClipboard';
import { formatExpiry } from '@/utils/formatters';
import { API } from '@/utils/constants';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  modelValue: Boolean,
});

const emit = defineEmits(['update:modelValue', 'edit']);

const { success, error } = useToast();
const { t } = useI18n();
const { getHeaders, authFetchJson } = useAuth();
const { copy } = useClipboard();

const loading = ref(false);
const shares = ref([]);
const page = ref(1);
const total = ref(0);
const totalPages = ref(1);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

const columns = computed(() => [
    { key: 'name', label: t('share.table.name') },
    { key: 'code', label: t('share.table.code') },
    { key: 'expiresAt', label: t('share.table.expires') },
    { key: 'actions', label: t('common.actions'), align: 'right' },
]);

const fetchShares = async () => {
  loading.value = true;
  try {
    const res = await authFetchJson(`${API.SHARES}?page=${page.value}&limit=20`);

    if (res.success) {
      shares.value = res.data.items;
      total.value = res.data.total;
      totalPages.value = res.data.totalPages;
    }
  } catch (_e) {
    error(t('common.loadFailed'));
  } finally {
    loading.value = false;
  }
};

// 格式化过期时间类名
const getExpiryClass = (ts) => {
  if (!ts) return 'text-success';
  if (ts < Date.now()) return 'text-danger font-medium';
  if (ts - Date.now() < 24 * 60 * 60 * 1000 * 3) return 'text-warning'; // < 3 days
  return 'text-(--text-secondary)';
};

const copyLink = async (item) => {
  const url = `${window.location.origin}${item.shareUrl}`;
  await copy(url, { successMessage: t('common.copied') });
};

const revokeShare = (item) => {
  confirmData.value = {
    show: true,
    title: t('common.confirm'),
    message: t('common.cancelShareConfirm', { name: item.name }),
    type: 'danger',
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        const res = await fetch(API.FOLDER_BY_ID(item.id), {
          method: 'PUT',
          headers: getHeaders(true),
          body: JSON.stringify({ isPublic: false, shareToken: null }),
        }).then((r) => r.json());

        if (res.success) {
          success(t('common.shareRevoked'));
          fetchShares();
          confirmData.value.show = false;
        } else {
          error(res.message);
        }
      } catch (_e) {
        error(t('common.operationFailed'));
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

const editShare = (item) => {
  // We can emit event to open parent's ShareFolderModal
  // But we need the full folder object.
  // Ideally we pass the ID to parent to fetch and open.
  emit('edit', item);
};

const close = () => {
  emit('update:modelValue', false);
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      page.value = 1;
      fetchShares();
    }
  }
);

watch(page, fetchShares);
</script>
