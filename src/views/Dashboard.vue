<template>
  <div class="space-y-6">
    <!-- 统计卡片 -->
    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-5">
        <div class="text-sm text-secondary mb-1">{{ t('dashboard.todayOrders') }}</div>
        <div class="text-3xl font-bold text-primary">{{ orderStats.todayCount }}</div>
      </div>
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-5">
        <div class="text-sm text-secondary mb-1">{{ t('dashboard.pendingOrders') }}</div>
        <div class="text-3xl font-bold text-danger">{{ orderStats.pendingCount }}</div>
      </div>
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-5">
        <div class="text-sm text-secondary mb-1">{{ t('dashboard.todayUploads') }}</div>
        <div class="text-3xl font-bold text-primary">{{ todayUploads }}</div>
      </div>
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-5">
        <div class="text-sm text-secondary mb-1">{{ t('dashboard.totalStorage') }}</div>
        <div class="text-3xl font-bold text-primary">{{ formatSize(totalSize) }}</div>
      </div>
    </div>

    <!-- 主要内容区域：布局优化 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 待处理订单 (新增) -->
      <div class="bg-white rounded-xl border border-[var(--border-color)] flex flex-col lg:col-span-1">
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 class="font-semibold text-primary">{{ t('dashboard.pendingOrders') }}</h3>
          <span v-if="orderStats.pendingCount > 0" class="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-medium">{{ orderStats.pendingCount }}</span>
        </div>
        <div v-if="orderStats.recentPendingOrders.length > 0" class="flex-1 overflow-y-auto max-h-[400px]">
          <div class="divide-y divide-[var(--border-color)]">
            <div 
              v-for="order in orderStats.recentPendingOrders" 
              :key="order.id"
              class="p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
              @click="viewOrder(order)"
            >
              <div class="flex items-start justify-between mb-1">
                <div class="font-medium text-primary group-hover:text-[var(--color-primary)] transition-colors">{{ order.orderNo }}</div>
                <div class="text-xs text-secondary">{{ formatRelativeTime(order.createdAt, t) }}</div>
              </div>
              <div class="text-sm text-secondary truncate">{{ order.name }}</div>
            </div>
          </div>
        </div>
        <div v-else class="p-6 text-center text-secondary text-sm flex-1 flex items-center justify-center">
          {{ t('dashboard.noPendingOrders') }}
        </div>
        <div class="p-3 border-t border-[var(--border-color)] text-center mt-auto">
            <button @click="setView('orders')" class="text-sm text-primary hover:underline">{{ t('dashboard.viewMore') }}</button>
        </div>
      </div>

      <!-- 右侧双栏：最近分享 + 最近文件 -->
      <div class="lg:col-span-2 space-y-6">
      <!-- 已分享链接 -->
      <div class="bg-white rounded-xl border border-[var(--border-color)] flex flex-col">
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 class="font-semibold text-primary">{{ t('dashboard.recentShares') }}</h3>
        </div>
        <div v-if="recentShares.length > 0" class="flex-1">
          <!-- 桌面端表格 -->
          <div class="hidden lg:block overflow-x-auto">
            <table class="w-full text-left text-sm">
               <thead class="bg-gray-50 text-secondary border-b border-[var(--border-color)]">
                  <tr>
                    <th class="px-6 py-3 font-medium">{{ t('dashboard.folder') }}</th>
                    <th class="px-6 py-3 font-medium">{{ t('dashboard.expiry') }}</th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-[var(--border-color)]">
                  <tr v-for="item in recentShares" :key="item.id" class="hover:bg-gray-50 transition-colors">
                     <td class="px-6 py-3 text-primary">
                         <div class="flex flex-col">
                             <span class="font-medium truncate max-w-[150px]">{{ item.name }}</span>
                             <span class="text-xs text-secondary font-mono mt-1 select-all cursor-pointer" @click="copyShareLink(item)" :title="t('dashboard.clickToCopy')">{{ item.shareToken }}</span>
                         </div>
                     </td>
                     <td class="px-6 py-3 text-secondary">{{ formatExpiry(item.expiresAt, t) }}</td>
                  </tr>
               </tbody>
            </table>
          </div>
          <!-- 移动端列表 -->
          <div class="lg:hidden divide-y divide-[var(--border-color)]">
             <div v-for="item in recentShares" :key="item.id" class="p-4 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <div class="flex-1 min-w-0 pr-4">
                  <div class="font-medium text-primary truncate">{{ item.name }}</div>
                  <div class="text-xs font-mono text-secondary mt-0.5">{{ item.shareToken }}</div>
                </div>
                <div class="text-xs text-secondary whitespace-nowrap">
                   {{ formatExpiry(item.expiresAt, t) }}
                </div>
             </div>
          </div>
        </div>
        <div v-else class="p-6 text-center text-secondary text-sm flex-1 flex items-center justify-center">
          {{ t('dashboard.noActiveShares') }}
        </div>
        <div class="p-3 border-t border-[var(--border-color)] text-center mt-auto">
            <button @click="showShareManager = true" class="text-sm text-primary hover:underline">{{ t('dashboard.viewMore') }}</button>
        </div>
      </div>

      <!-- 最近文件 -->
      <div class="bg-white rounded-xl border border-[var(--border-color)] flex flex-col">
        <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 class="font-semibold text-primary">{{ t('dashboard.recentFiles') }}</h3>
        </div>
        <div v-if="recentFiles.length > 0" class="flex-1">
          <!-- 桌面端表格 -->
          <div class="hidden lg:block overflow-x-auto">
            <table class="w-full text-left text-sm">
               <thead class="bg-gray-50 text-secondary border-b border-[var(--border-color)]">
                  <tr>
                    <th class="px-6 py-3 font-medium">{{ t('dashboard.name') }}</th>
                    <th class="px-6 py-3 font-medium">{{ t('dashboard.size') }}</th>
                    <th class="px-6 py-3 font-medium">{{ t('dashboard.uploadTime') }}</th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-[var(--border-color)]">
                  <tr v-for="(file, index) in recentFiles" :key="index" class="hover:bg-gray-50 transition-colors">
                     <td class="px-6 py-3 text-primary">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs text-secondary uppercase border border-[var(--border-color)] flex-shrink-0">
                                {{ file.type || getFileExtension(file.name) }}
                            </div>
                            <span class="truncate max-w-[150px]" :title="file.name">{{ file.name }}</span>
                        </div>
                     </td>
                     <td class="px-6 py-3 text-secondary whitespace-nowrap">{{ formatSize(file.size) }}</td>
                     <td class="px-6 py-3 text-secondary whitespace-nowrap">{{ formatDate(file.timestamp) }}</td>
                  </tr>
               </tbody>
            </table>
          </div>
          <!-- 移动端列表 -->
          <div class="lg:hidden divide-y divide-[var(--border-color)]">
             <div v-for="(file, index) in recentFiles" :key="index" class="p-4 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <div class="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-xs text-secondary uppercase border border-[var(--border-color)] flex-shrink-0">
                    {{ file.type || getFileExtension(file.name) }}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-primary truncate text-sm" :title="file.name">{{ file.name }}</div>
                    <div class="text-xs text-secondary mt-0.5 flex items-center gap-2">
                       <span>{{ formatSize(file.size) }}</span>
                       <span>·</span>
                       <span>{{ formatDate(file.timestamp) }}</span>
                    </div>
                </div>
             </div>
          </div>
        </div>
        <div v-else class="p-6 text-center text-secondary text-sm flex-1 flex items-center justify-center">
          {{ t('dashboard.noRecentFiles') }}
        </div>
        <div class="p-3 border-t border-[var(--border-color)] text-center mt-auto">
             <button @click="setView('files')" class="text-sm text-primary hover:underline">{{ t('dashboard.viewAll') }}</button>
        </div>
      </div>
      </div>
    </div>

    <!-- Modals -->
    <ShareManagementModal 
        v-model="showShareManager" 
        @edit="handleManagerEdit"
    />
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
import { formatSize, formatDate, formatExpiry, getFileExtension, formatRelativeTime } from '@/utils/formatters';
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
    recentPendingOrders: []
});

const showShareManager = ref(false);
const showEditShare = ref(false);
const editingFolder = ref(null);

const showDetailModal = ref(false);
const viewingOrder = ref(null);

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

const revokeShare = async (item) => {
    if (!confirm(t('dashboard.confirmRevoke', { name: item.name }))) return;
    try {
        const res = await fetch(API.FOLDER_BY_ID(item.id), {
            method: 'PUT',
            headers: getHeaders(true),
            body: JSON.stringify({ isPublic: false, shareToken: null })
        }).then(r => r.json());

        if (res.success) {
            success(t('dashboard.shareRevoked'));
            fetchRecentShares();
        } else {
            error(res.message);
        }
    } catch (e) {
        error(t('dashboard.operationFailed'));
    }
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
