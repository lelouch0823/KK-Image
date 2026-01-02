<template>
  <div class="space-y-6">
    <!-- 统计卡片 -->
    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-[var(--border-color)] bg-white p-5">
        <div class="text-secondary mb-1 text-sm">{{ t('dashboard.todayOrders') }}</div>
        <div class="text-primary text-3xl font-bold">{{ orderStats.todayCount }}</div>
      </div>
      <div class="rounded-xl border border-[var(--border-color)] bg-white p-5">
        <div class="text-secondary mb-1 text-sm">{{ t('dashboard.pendingOrders') }}</div>
        <div class="text-danger text-3xl font-bold">{{ orderStats.pendingCount }}</div>
      </div>
      <div class="rounded-xl border border-[var(--border-color)] bg-white p-5">
        <div class="text-secondary mb-1 text-sm">{{ t('dashboard.todayUploads') }}</div>
        <div class="text-primary text-3xl font-bold">{{ todayUploads }}</div>
      </div>
      <div class="rounded-xl border border-[var(--border-color)] bg-white p-5">
        <div class="text-secondary mb-1 text-sm">{{ t('dashboard.totalStorage') }}</div>
        <div class="text-primary text-3xl font-bold">{{ formatSize(totalSize) }}</div>
      </div>
    </div>

    <!-- 主要内容区域：布局优化 -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- 待处理订单 (新增) -->
      <div
        class="flex flex-col rounded-xl border border-[var(--border-color)] bg-white lg:col-span-1"
      >
        <div
          class="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4"
        >
          <h3 class="text-primary font-semibold">{{ t('dashboard.pendingOrders') }}</h3>
          <span
            v-if="orderStats.pendingCount > 0"
            class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600"
            >{{ orderStats.pendingCount }}</span
          >
        </div>
        <div
          v-if="orderStats.recentPendingOrders.length > 0"
          class="max-h-[400px] flex-1 overflow-y-auto"
        >
          <div class="divide-y divide-[var(--border-color)]">
            <div
              v-for="order in orderStats.recentPendingOrders"
              :key="order.id"
              class="group cursor-pointer p-4 transition-colors hover:bg-gray-50"
              @click="viewOrder(order)"
            >
              <div class="mb-1 flex items-start justify-between">
                <div
                  class="text-primary font-medium transition-colors group-hover:text-[var(--color-primary)]"
                >
                  {{ order.orderNo }}
                </div>
                <div class="text-secondary text-xs">
                  {{ formatRelativeTime(order.createdAt, t) }}
                </div>
              </div>
              <div class="text-secondary truncate text-sm">{{ order.name }}</div>
            </div>
          </div>
        </div>
        <div
          v-else
          class="text-secondary flex flex-1 items-center justify-center p-6 text-center text-sm"
        >
          {{ t('dashboard.noPendingOrders') }}
        </div>
        <div class="mt-auto border-t border-[var(--border-color)] p-3 text-center">
          <button class="text-primary text-sm hover:underline" @click="setView('orders')">
            {{ t('dashboard.viewMore') }}
          </button>
        </div>
      </div>

      <!-- 右侧双栏：最近分享 + 最近文件 -->
      <div class="space-y-6 lg:col-span-2">
        <!-- 已分享链接 -->
        <div class="flex flex-col rounded-xl border border-[var(--border-color)] bg-white">
          <div
            class="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4"
          >
            <h3 class="text-primary font-semibold">{{ t('dashboard.recentShares') }}</h3>
          </div>
          <div v-if="recentShares.length > 0" class="flex-1">
            <!-- 桌面端表格 -->
            <div class="hidden overflow-x-auto lg:block">
              <table class="w-full text-left text-sm">
                <thead class="text-secondary border-b border-[var(--border-color)] bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 font-medium">{{ t('dashboard.folder') }}</th>
                    <th class="px-6 py-3 font-medium">{{ t('dashboard.expiry') }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--border-color)]">
                  <tr
                    v-for="item in recentShares"
                    :key="item.id"
                    class="transition-colors hover:bg-gray-50"
                  >
                    <td class="text-primary px-6 py-3">
                      <div class="flex flex-col">
                        <span class="max-w-[150px] truncate font-medium">{{ item.name }}</span>
                        <span
                          class="text-secondary mt-1 cursor-pointer font-mono text-xs select-all"
                          :title="t('dashboard.clickToCopy')"
                          @click="copyShareLink(item)"
                          >{{ item.shareToken }}</span
                        >
                      </div>
                    </td>
                    <td class="text-secondary px-6 py-3">{{ formatExpiry(item.expiresAt, t) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- 移动端列表 -->
            <div class="divide-y divide-[var(--border-color)] lg:hidden">
              <div
                v-for="item in recentShares"
                :key="item.id"
                class="flex items-center justify-between p-4 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                <div class="min-w-0 flex-1 pr-4">
                  <div class="text-primary truncate font-medium">{{ item.name }}</div>
                  <div class="text-secondary mt-0.5 font-mono text-xs">{{ item.shareToken }}</div>
                </div>
                <div class="text-secondary text-xs whitespace-nowrap">
                  {{ formatExpiry(item.expiresAt, t) }}
                </div>
              </div>
            </div>
          </div>
          <div
            v-else
            class="text-secondary flex flex-1 items-center justify-center p-6 text-center text-sm"
          >
            {{ t('dashboard.noActiveShares') }}
          </div>
          <div class="mt-auto border-t border-[var(--border-color)] p-3 text-center">
            <button class="text-primary text-sm hover:underline" @click="showShareManager = true">
              {{ t('dashboard.viewMore') }}
            </button>
          </div>
        </div>

        <!-- 最近文件 -->
        <div class="flex flex-col rounded-xl border border-[var(--border-color)] bg-white">
          <div
            class="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4"
          >
            <h3 class="text-primary font-semibold">{{ t('dashboard.recentFiles') }}</h3>
          </div>
          <div v-if="recentFiles.length > 0" class="flex-1">
            <!-- 桌面端表格 -->
            <div class="hidden overflow-x-auto lg:block">
              <table class="w-full text-left text-sm">
                <thead class="text-secondary border-b border-[var(--border-color)] bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 font-medium">{{ t('dashboard.name') }}</th>
                    <th class="px-6 py-3 font-medium">{{ t('dashboard.size') }}</th>
                    <th class="px-6 py-3 font-medium">{{ t('dashboard.uploadTime') }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--border-color)]">
                  <tr
                    v-for="(file, index) in recentFiles"
                    :key="index"
                    class="transition-colors hover:bg-gray-50"
                  >
                    <td class="text-primary px-6 py-3">
                      <div class="flex items-center gap-2">
                        <div
                          class="text-secondary flex size-8 flex-shrink-0 items-center justify-center rounded border border-[var(--border-color)] bg-gray-100 text-xs uppercase"
                        >
                          {{ file.type || getFileExtension(file.name) }}
                        </div>
                        <span class="max-w-[150px] truncate" :title="file.name">{{
                          file.name
                        }}</span>
                      </div>
                    </td>
                    <td class="text-secondary px-6 py-3 whitespace-nowrap">
                      {{ formatSize(file.size) }}
                    </td>
                    <td class="text-secondary px-6 py-3 whitespace-nowrap">
                      {{ formatDate(file.timestamp) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- 移动端列表 -->
            <div class="divide-y divide-[var(--border-color)] lg:hidden">
              <div
                v-for="(file, index) in recentFiles"
                :key="index"
                class="flex items-center gap-3 p-4 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                <div
                  class="text-secondary flex size-10 flex-shrink-0 items-center justify-center rounded border border-[var(--border-color)] bg-gray-100 text-xs uppercase"
                >
                  {{ file.type || getFileExtension(file.name) }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-primary truncate text-sm font-medium" :title="file.name">
                    {{ file.name }}
                  </div>
                  <div class="text-secondary mt-0.5 flex items-center gap-2 text-xs">
                    <span>{{ formatSize(file.size) }}</span>
                    <span>·</span>
                    <span>{{ formatDate(file.timestamp) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            v-else
            class="text-secondary flex flex-1 items-center justify-center p-6 text-center text-sm"
          >
            {{ t('dashboard.noRecentFiles') }}
          </div>
          <div class="mt-auto border-t border-[var(--border-color)] p-3 text-center">
            <button class="text-primary text-sm hover:underline" @click="setView('files')">
              {{ t('dashboard.viewAll') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ShareManagementModal v-model="showShareManager" @edit="handleManagerEdit" />
    <ShareFolderModal
      v-model="showEditShare"
      :folder="editingFolder"
      @updated="handleEditUpdated"
    />
    <!-- 订单详情弹窗 -->
    <Modal v-model="showDetailModal" size="6xl" :title="t('order.detail.title')">
      <OrderDetail
        v-if="viewingOrder"
        :order="viewingOrder"
        mode="admin"
        @back="closeDetailModal"
        @refresh="refreshOrderDetail"
      />
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
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated } from 'vue';
import { useView } from '@/composables/useView';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { useOrders } from '@/composables/useOrders';
import ShareManagementModal from '@/components/ShareManagementModal.vue';
import ShareFolderModal from '@/components/ShareFolderModal.vue';
import Modal from '@/components/ui/Modal.vue';
import OrderDetail from '@/components/order/OrderDetail.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import {
  formatSize,
  formatDate,
  formatExpiry,
  getFileExtension,
  formatRelativeTime,
} from '@/utils/formatters';
import { API } from '@/utils/constants';

const { setView } = useView();
const { error, success } = useToast();
const { getHeaders, authFetchJson } = useAuth();
const { t } = useI18n();
const { getOrder } = useOrders();

const totalFiles = ref(0);
const todayUploads = ref(0);
const totalSize = ref(0);
const recentFiles = ref([]);
const recentShares = ref([]);
const orderStats = ref({
  todayCount: 0,
  pendingCount: 0,
  recentPendingOrders: [],
});

const showShareManager = ref(false);
const showEditShare = ref(false);
const editingFolder = ref(null);

const showDetailModal = ref(false);
const viewingOrder = ref(null);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

const viewOrder = async (order) => {
  const fullOrder = await getOrder(order.id);
  if (fullOrder) {
    viewingOrder.value = fullOrder;
    showDetailModal.value = true;
  }
};

const closeDetailModal = () => {
  showDetailModal.value = false;
  viewingOrder.value = null;

  // 刷新统计数据，以防状态变更
  fetchOrderStats();
};

const refreshOrderDetail = async () => {
  if (viewingOrder.value) {
    const fullOrder = await getOrder(viewingOrder.value.id);
    if (fullOrder) {
      viewingOrder.value = fullOrder;
    }
  }
  fetchOrderStats();
};

const fetchOrderStats = async () => {
  try {
    const res = await authFetchJson(API.MANAGE_DASHBOARD_OVERVIEW);
    if (res.success && res.data) {
      orderStats.value = res.data;
    }
  } catch (e) {
    console.error('Order stats load failed', e);
  }
};

const fetchStats = async () => {
  try {
    const res = await authFetchJson(API.STATS);

    if (res.success && res.data) {
      totalFiles.value = res.data.files?.total || 0;
      todayUploads.value = res.data.files?.todayUploads || 0;
      totalSize.value = res.data.files?.totalSize || 0;

      // Fix: Recent files are nested in data.recentFiles
      if (res.data.recentFiles) {
        recentFiles.value = res.data.recentFiles;
      }
    }
  } catch (e) {
    console.error('Stats load failed', e);
  }
};

const fetchRecentShares = async () => {
  try {
    const res = await authFetchJson(`${API.SHARES}?limit=5`);

    if (res.success) {
      recentShares.value = res.data.items;
    }
  } catch (e) {
    console.error('Shares load failed', e);
  }
};

const copyShareLink = (item) => {
  const url = `${window.location.origin}${item.shareUrl}`;
  navigator.clipboard.writeText(url).then(() => success(t('dashboard.linkCopied')));
};

const editShare = (item) => {
  editingFolder.value = item;
  showEditShare.value = true;
};

const handleEditUpdated = () => {
  fetchRecentShares();
  // Maybe also refresh manager if open? Manager does its own fetch on open.
};

const handleManagerEdit = (item) => {
  // Called from View More Modal
  editingFolder.value = item;
  showEditShare.value = true;
};

const revokeShare = (item) => {
  confirmData.value = {
    show: true,
    title: t('dashboard.revokeShareTitle') || t('common.confirm'),
    message: t('dashboard.confirmRevoke', { name: item.name }),
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
          success(t('dashboard.shareRevoked'));
          fetchRecentShares();
          confirmData.value.show = false;
        } else {
          error(res.message);
        }
      } catch (e) {
        error(t('dashboard.operationFailed'));
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

onMounted(() => {
  fetchStats();
  fetchRecentShares();
  fetchOrderStats();
});

onActivated(() => {
  fetchStats();
  fetchRecentShares();
  fetchOrderStats();
});
</script>
