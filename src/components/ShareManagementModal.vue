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
                    :title="t('common.copyLink') || '复制链接'"
                    @click="copyLink(item)"
                  >
                    <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                      ></path>
                    </svg>
                  </button>
                </div>
              </td>
              <td class="px-6 py-3">
                <span :class="getExpiryClass(item.expiresAt)">{{
                  formatExpiry(item.expiresAt, t)
                }}</span>
              </td>
              <td class="px-6 py-3 text-right">
                <button class="text-primary mr-3 hover:text-blue-600" @click="editShare(item)">
                  {{ t('common.edit') }}
                </button>
                <button class="text-red-500 hover:text-red-700" @click="revokeShare(item)">
                  {{ t('common.cancelShare') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards -->
      <div class="space-y-4 lg:hidden">
        <div
          v-for="item in shares"
          :key="item.id"
          class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] p-4"
        >
          <div class="mb-3 flex items-start justify-between">
            <div class="text-primary text-base font-medium">{{ item.name }}</div>
            <div class="flex gap-2">
              <button
                class="text-primary rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-1.5 shadow-sm"
                @click="editShare(item)"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  ></path>
                </svg>
              </button>
              <button
                class="rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-1.5 text-red-500 shadow-sm"
                @click="revokeShare(item)"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="text-secondary flex flex-col gap-2 text-sm">
            <div class="flex items-center justify-between">
              <span>{{ t('share.linkToken') }}:</span>
              <div class="flex items-center gap-2">
                <span class="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-0.5 font-mono">{{
                  item.shareToken
                }}</span>
                <button class="text-primary" @click="copyLink(item)">
                  <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span>{{ t('share.expiry') }}:</span>
              <span :class="getExpiryClass(item.expiresAt)">{{
                formatExpiry(item.expiresAt, t)
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="shares.length === 0 && !loading" class="text-secondary py-12 text-center">
        {{ t('common.noData') }}
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-secondary py-12 text-center">
        {{ t('common.loading') }}
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
import { ref, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useClipboard } from '@/composables/useClipboard';
import { formatExpiry } from '@/utils/formatters';
import { API } from '@/utils/constants';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

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
  if (!ts) return 'text-green-600';
  if (ts < Date.now()) return 'text-red-500 font-medium';
  if (ts - Date.now() < 24 * 60 * 60 * 1000 * 3) return 'text-orange-500'; // < 3 days
  return 'text-secondary';
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
