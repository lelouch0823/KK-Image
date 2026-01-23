<template>
  <div class="relative min-h-screen w-full overflow-hidden bg-slate-900 text-slate-200">
    <!-- Fixed Background Gradient Mesh -->
    <div class="fixed inset-0 z-0 pointer-events-none">
      <div
        class="absolute -top-[10%] -right-[10%] size-[600px] animate-pulse rounded-full bg-indigo-600/20 blur-[120px]"
      ></div>
       <div
        class="absolute top-[40%] -left-[10%] size-[500px] animate-pulse rounded-full bg-cyan-600/10 blur-[100px]"
        style="animation-delay: 2s"
      ></div>
      <div
        class="absolute -bottom-[10%] right-[20%] size-[600px] animate-pulse rounded-full bg-purple-600/20 blur-[100px]"
        style="animation-delay: 4s"
      ></div>
      <div
        class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"
      ></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 px-4 py-6 sm:px-6 lg:px-8">
      
      <!-- Metrics Grid -->
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <!-- Today Orders -->
        <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 animate-fade-in-up" style="animation-delay: 0ms">
           <div class="flex items-center justify-between">
              <div>
                 <p class="text-sm font-medium text-slate-400">{{ t('dashboard.todayOrders') }}</p>
                 <p class="mt-2 text-3xl font-bold font-mono text-white">{{ orderStats.todayCount }}</p>
              </div>
              <div class="rounded-xl bg-blue-500/20 p-3 text-blue-400">
                 <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
              </div>
           </div>
        </div>

        <!-- Pending Orders -->
        <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/10 animate-fade-in-up" style="animation-delay: 100ms">
           <div class="absolute -right-6 -top-6 size-24 bg-red-500/10 blur-2xl rounded-full transition-transform group-hover:scale-150"></div>
           <div class="relative flex items-center justify-between">
              <div>
                 <p class="text-sm font-medium text-slate-400">{{ t('dashboard.pendingOrders') }}</p>
                 <p class="mt-2 text-3xl font-bold font-mono text-red-400">{{ orderStats.pendingCount }}</p>
              </div>
              <div class="rounded-xl bg-red-500/20 p-3 text-red-400 animate-pulse">
                 <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
              </div>
           </div>
        </div>

        <!-- Week Orders -->
        <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/10 animate-fade-in-up" style="animation-delay: 200ms">
           <div class="flex items-center justify-between">
              <div>
                 <div class="flex items-center gap-2">
                    <p class="text-sm font-medium text-slate-400">{{ t('dashboard.weekOrders') }}</p>
                    <span
                        v-if="weekTrend !== 0"
                        :class="weekTrend > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'"
                        class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    >
                        {{ weekTrend > 0 ? '↑' : '↓' }} {{ Math.abs(weekTrend) }}%
                    </span>
                 </div>
                 <p class="mt-2 text-3xl font-bold font-mono text-white">{{ orderStats.weekCount || 0 }}</p>
              </div>
              <div class="rounded-xl bg-green-500/20 p-3 text-green-400">
                 <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                 </svg>
              </div>
           </div>
        </div>

        <!-- Active Shares -->
        <div class="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:bg-white/10 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10 animate-fade-in-up" style="animation-delay: 300ms">
           <div class="flex items-center justify-between">
              <div>
                 <p class="text-sm font-medium text-slate-400">{{ t('dashboard.activeShares') }}</p>
                 <p class="mt-2 text-3xl font-bold font-mono text-white">{{ orderStats.activeSharesCount || 0 }}</p>
              </div>
              <div class="rounded-xl bg-purple-500/20 p-3 text-purple-400">
                 <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                 </svg>
              </div>
           </div>
        </div>
      </div>

      <!-- Main Layout -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        <!-- Pending Orders List (Left Column) -->
        <div class="flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md lg:col-span-1 animate-fade-in-up" style="animation-delay: 400ms">
            <div class="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <h3 class="font-semibold text-white flex items-center gap-2">
                    <span class="size-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]"></span>
                    {{ t('dashboard.pendingOrders') }}
                </h3>
                 <span
                    v-if="orderStats.pendingCount > 0"
                    class="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400 border border-red-500/20"
                >
                    {{ orderStats.pendingCount }}
                </span>
            </div>
            
            <div v-if="orderStats.recentPendingOrders.length > 0" class="flex-1 overflow-y-auto max-h-[400px]">
                <div class="divide-y divide-white/5">
                    <div
                        v-for="order in orderStats.recentPendingOrders"
                        :key="order.id"
                        class="group cursor-pointer p-4 transition-colors hover:bg-white/5"
                        @click="viewOrder(order)"
                    >
                        <div class="mb-1 flex items-start justify-between">
                            <span class="font-mono font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
                                {{ order.orderNo }}
                            </span>
                             <span class="text-xs text-slate-500">{{ formatRelativeTime(order.createdAt, t) }}</span>
                        </div>
                        <div class="text-sm text-slate-300">{{ order.name }}</div>
                    </div>
                </div>
            </div>
             <div v-else class="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
                 <div class="flex flex-col items-center gap-2">
                     <svg class="size-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                     {{ t('dashboard.noPendingOrders') }}
                 </div>
             </div>
             <div class="border-t border-white/10 p-3 text-center">
                <button 
                  class="text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center w-full gap-1"
                   @click="router.push('/admin/orders')"
                >
                    {{ t('dashboard.viewMore') }} →
                </button>
             </div>
        </div>

        <!-- Right Column: Recent Shares & Files -->
        <div class="space-y-6 lg:col-span-2">
            <!-- Recent Shares -->
            <div class="flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md animate-fade-in-up" style="animation-delay: 500ms">
                <div class="flex items-center justify-between border-b border-white/10 px-6 py-4">
                     <h3 class="font-semibold text-white flex items-center gap-2">
                        <span class="size-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)]"></span>
                        {{ t('dashboard.recentShares') }}
                    </h3>
                </div>
                
                <div v-if="recentShares.length > 0" class="flex-1">
                    <!-- Desktop Table -->
                    <div class="hidden lg:block overflow-x-auto">
                        <table class="w-full text-left text-sm">
                             <thead class="text-slate-400 border-b border-white/10 bg-white/5">
                                <tr>
                                    <th class="px-6 py-3 font-medium">{{ t('dashboard.folder') }}</th>
                                    <th class="px-6 py-3 font-medium">{{ t('dashboard.expiry') }}</th>
                                </tr>
                             </thead>
                             <tbody class="divide-y divide-white/5">
                                <tr v-for="item in recentShares" :key="item.id" class="transition-colors hover:bg-white/5">
                                    <td class="px-6 py-3">
                                        <div class="flex flex-col">
                                            <span class="font-medium text-slate-200">{{ item.name }}</span>
                                            <span 
                                                class="mt-1 cursor-pointer font-mono text-xs text-blue-400 hover:text-blue-300 select-all"
                                                :title="t('dashboard.clickToCopy')"
                                                @click="handleCopyShareLink(item)"
                                            >
                                                {{ item.shareToken }}
                                            </span>
                                        </div>
                                    </td>
                                    <td class="px-6 py-3 text-slate-400">{{ formatExpiry(item.expiresAt, t) }}</td>
                                </tr>
                             </tbody>
                        </table>
                    </div>

                    <!-- Mobile List -->
                    <div class="lg:hidden divide-y divide-white/5">
                        <div v-for="item in recentShares" :key="item.id" class="p-4 flex items-center justify-between hover:bg-white/5">
                             <div class="min-w-0 flex-1 pr-4">
                                <div class="text-slate-200 font-medium truncate">{{ item.name }}</div>
                                <div class="text-blue-400/80 font-mono text-xs mt-0.5">{{ item.shareToken }}</div>
                             </div>
                             <div class="text-xs text-slate-500 whitespace-nowrap bg-slate-800/50 px-2 py-1 rounded">
                                {{ formatExpiry(item.expiresAt, t) }}
                             </div>
                        </div>
                    </div>
                </div>
                <div v-else class="flex h-32 items-center justify-center text-sm text-slate-500">
                    {{ t('dashboard.noActiveShares') }}
                </div>
                 <div class="border-t border-white/10 p-3 text-center">
                    <button class="text-sm text-slate-400 hover:text-white transition-colors" @click="showShareManager = true">
                         {{ t('dashboard.viewMore') }} →
                    </button>
                 </div>
            </div>

            <!-- Recent Files -->
            <div class="flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md animate-fade-in-up" style="animation-delay: 600ms">
                 <div class="flex items-center justify-between border-b border-white/10 px-6 py-4">
                     <h3 class="font-semibold text-white flex items-center gap-2">
                        <span class="size-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)]"></span>
                        {{ t('dashboard.recentFiles') }}
                    </h3>
                </div>

                <div v-if="recentFiles.length > 0" class="flex-1">
                     <!-- Desktop Table -->
                     <div class="hidden lg:block overflow-x-auto">
                         <table class="w-full text-left text-sm">
                             <thead class="text-slate-400 border-b border-white/10 bg-white/5">
                                 <tr>
                                     <th class="px-6 py-3 font-medium">{{ t('dashboard.name') }}</th>
                                     <th class="px-6 py-3 font-medium">{{ t('dashboard.size') }}</th>
                                     <th class="px-6 py-3 font-medium">{{ t('dashboard.uploadTime') }}</th>
                                 </tr>
                             </thead>
                             <tbody class="divide-y divide-white/5">
                                 <tr v-for="(file, index) in recentFiles" :key="index" class="transition-colors hover:bg-white/5">
                                     <td class="px-6 py-3">
                                         <div class="flex items-center gap-3">
                                             <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase ring-1 ring-inset ring-indigo-500/30">
                                                 {{ file.type || getFileExtension(file.name) }}
                                             </div>
                                             <span class="text-slate-200 truncate max-w-[200px]" :title="file.name">{{ file.name }}</span>
                                         </div>
                                     </td>
                                     <td class="px-6 py-3 font-mono text-slate-400">{{ formatSize(file.size) }}</td>
                                     <td class="px-6 py-3 text-slate-500">{{ formatDate(file.timestamp) }}</td>
                                 </tr>
                             </tbody>
                         </table>
                     </div>

                     <!-- Mobile List -->
                     <div class="lg:hidden divide-y divide-white/5">
                         <div v-for="(file, index) in recentFiles" :key="index" class="p-4 flex items-center gap-4 hover:bg-white/5">
                             <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase ring-1 ring-inset ring-indigo-500/30">
                                  {{ file.type || getFileExtension(file.name) }}
                             </div>
                             <div class="min-w-0 flex-1">
                                 <div class="text-slate-200 font-medium truncate text-sm">{{ file.name }}</div>
                                 <div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                     <span class="font-mono text-slate-400">{{ formatSize(file.size) }}</span>
                                     <span>·</span>
                                     <span>{{ formatDate(file.timestamp) }}</span>
                                 </div>
                             </div>
                         </div>
                     </div>
                </div>
                 <div v-else class="flex h-32 items-center justify-center text-sm text-slate-500">
                    {{ t('dashboard.noRecentFiles') }}
                </div>
                 <div class="border-t border-white/10 p-3 text-center">
                    <button class="text-sm text-slate-400 hover:text-white transition-colors" @click="router.push('/admin/files')">
                         {{ t('dashboard.viewAll') }} →
                    </button>
                 </div>
            </div>
        </div>
      </div>
    </div>

    <!-- Modals (Passing props to ensure they work in dark mode if needed, or keeping them standard) -->
    <ShareManagementModal v-model="showShareManager" @edit="handleManagerEdit" />
    <ShareFolderModal
      v-model="showEditShare"
      :folder="editingFolder"
      @updated="handleEditUpdated"
    />
    <Modal v-model="showDetailModal" size="6xl" :title="t('order.detail.title')">
      <OrderDetail
        v-if="viewingOrder"
        :order="viewingOrder"
        mode="admin"
        @back="closeDetailModal"
        @refresh="refreshOrderDetail"
      />
    </Modal>
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
import { ref, onMounted, onActivated, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { useOrders } from '@/composables/useOrders';
import { useClipboard } from '@/composables/useClipboard';
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

const router = useRouter();
const { error, success } = useToast();
const { getHeaders, authFetchJson } = useAuth();
const { t } = useI18n();
const { getOrder } = useOrders();
const { copyShareLink } = useClipboard();

const recentFiles = ref([]);
const recentShares = ref([]);
const orderStats = ref({
  todayCount: 0,
  pendingCount: 0,
  weekCount: 0,
  lastWeekCount: 0,
  activeSharesCount: 0,
  recentPendingOrders: [],
});

// 计算周环比趋势百分比
const weekTrend = computed(() => {
  const current = orderStats.value.weekCount || 0;
  const last = orderStats.value.lastWeekCount || 0;
  if (last === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - last) / last) * 100);
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

const handleCopyShareLink = async (item) => {
  await copyShareLink(item.shareUrl, { successMessage: t('dashboard.linkCopied') });
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
          await fetchOrderStats();
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

<style scoped>
@keyframes fade-in-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up {
    animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0; /* Init hidden */
}
</style>
