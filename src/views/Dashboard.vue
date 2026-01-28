<template>
  <div class="relative min-h-screen w-full overflow-hidden bg-(--bg-page) text-(--text-main) transition-colors duration-300">
    <!-- Fixed Background Gradient Mesh -->
    <!-- Background Gradient Mesh -->
    <div class="pointer-events-none fixed inset-0 z-0">
      <div
        class="absolute -top-[20%] -left-[10%] size-[800px] animate-pulse rounded-full bg-blue-400/20 blur-[120px] dark:bg-blue-600/20"
      ></div>
      <div
        class="absolute top-[20%] right-[0%] size-[600px] animate-pulse rounded-full bg-purple-600/20 blur-[100px]"
        style="animation-delay: 2s"
      ></div>
      <div
        class="absolute -bottom-[20%] left-[20%] size-[600px] animate-pulse rounded-full bg-teal-600/20 blur-[100px]"
        style="animation-delay: 4s"
      ></div>
      <!-- Grid Overlay -->
      <div
        class="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-size-[40px_40px] opacity-20 dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]"
      ></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 px-4 py-6 sm:px-6 lg:px-8">
      
      <!-- Metrics Grid -->
      <div class="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Today Orders -->
        <AppStatCard
          :label="t('dashboard.todayOrders')"
          :value="orderStats.todayCount"
          variant="info"
          glow
          class="animate-fade-in-up"
          style="animation-delay: 0ms"
        >
          <template #icon>
            <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </template>
        </AppStatCard>

        <!-- Pending Orders -->
        <AppStatCard
          :label="t('dashboard.pendingOrders')"
          :value="orderStats.pendingCount"
          variant="danger"
          glow
          class="animate-fade-in-up"
          style="animation-delay: 100ms"
        >
          <template #icon>
            <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </template>
        </AppStatCard>

        <!-- Week Orders -->
        <AppStatCard
          :label="t('dashboard.weekOrders')"
          :value="orderStats.weekCount || 0"
          :trend="weekTrend"
          variant="success"
          glow
          class="animate-fade-in-up"
          style="animation-delay: 200ms"
        >
          <template #icon>
            <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </template>
        </AppStatCard>

        <!-- Active Shares -->
        <AppStatCard
          :label="t('dashboard.activeShares')"
          :value="orderStats.activeSharesCount || 0"
          variant="purple"
          glow
          class="animate-fade-in-up"
          style="animation-delay: 300ms"
        >
          <template #icon>
            <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </template>
        </AppStatCard>
      </div>

      <!-- Main Layout -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        <!-- Pending Orders List (Left Column) -->
        <AppCard
          indicator="danger"
          padding="p-0"
          class="animate-fade-in-up lg:col-span-1"
          style="animation-delay: 400ms"
        >
          <template #header>
            <div class="flex flex-1 items-center justify-between">
              <h3 class="font-semibold text-(--text-main)">
                {{ t('dashboard.pendingOrders') }}
              </h3>
              <span
                v-if="orderStats.pendingCount > 0"
                class="rounded-full border border-danger/20 bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger-text"
              >
                {{ orderStats.pendingCount }}
              </span>
            </div>
          </template>
            
            <div v-if="orderStats.recentPendingOrders.length > 0" class="max-h-[400px] flex-1 overflow-y-auto">
                <div class="divide-y divide-(--border-color)">
                    <div
                        v-for="order in orderStats.recentPendingOrders"
                        :key="order.id"
                        class="group cursor-pointer p-4 transition-colors hover:bg-(--bg-hover)"
                        @click="viewOrder(order)"
                    >
                        <div class="mb-1 flex items-start justify-between">
                            <span class="font-mono font-medium text-primary transition-colors group-hover:text-primary-hover">
                                {{ order.orderNo }}
                            </span>
                             <span class="text-xs text-(--text-secondary)">{{ formatRelativeTime(order.createdAt, t) }}</span>
                        </div>
                        <div class="text-sm text-(--text-main)">{{ order.name }}</div>
                    </div>
                </div>
            </div>
             <div v-else class="flex flex-1 items-center justify-center p-8 text-center text-sm text-(--text-secondary)">
                 <div class="flex flex-col items-center gap-2">
                     <svg class="size-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                     {{ t('dashboard.noPendingOrders') }}
                 </div>
             </div>
             <template #footer>
                <AppButton
                  variant="ghost"
                  block
                  size="sm"
                  :text="t('dashboard.viewMore') + ' →'"
                  @click="router.push('/admin/orders')"
                />
             </template>
        </AppCard>

        <!-- Right Column: Recent Shares & Files -->
        <div class="space-y-6 lg:col-span-2">
            <!-- Recent Shares -->
            <AppCard
              indicator="purple"
              padding="p-0"
              class="animate-fade-in-up"
              style="animation-delay: 500ms"
            >
              <template #header>
                <h3 class="font-semibold text-(--text-main)">
                  {{ t('dashboard.recentShares') }}
                </h3>
              </template>
                
                <div v-if="recentShares.length > 0" class="flex-1">
                    <!-- Desktop Table -->
                    <div class="hidden lg:block">
                        <AppTable
                            :columns="recentSharesColumns"
                            :data="recentShares"
                        >
                            <template #cell-name="{ row }">
                                <div class="flex flex-col">
                                    <span class="font-medium text-(--text-main)">{{ row.name }}</span>
                                     <span 
                                         class="mt-1 cursor-pointer font-mono text-xs text-primary select-all hover:text-[var(--color-primary-hover)]"
                                         :title="t('dashboard.clickToCopy')"
                                         @click.stop="handleCopyShareLink(row)"
                                     >
                                        {{ row.shareToken }}
                                    </span>
                                </div>
                            </template>
                            <template #cell-expiresAt="{ row }">
                                {{ formatExpiry(row.expiresAt, t) }}
                            </template>
                        </AppTable>
                    </div>

                     <!-- Mobile List -->
                     <div class="divide-y divide-(--border-color)/30 lg:hidden">
                         <div v-for="item in recentShares" :key="item.id" class="flex items-center justify-between p-4 hover:bg-(--bg-hover)">
                              <div class="min-w-0 flex-1 pr-4">
                                 <div class="truncate font-medium text-(--text-main)">{{ item.name }}</div>
                                 <div class="mt-0.5 font-mono text-xs text-primary/80">{{ item.shareToken }}</div>
                              </div>
                              <div class="rounded bg-[var(--bg-muted)] px-2 py-1 text-xs whitespace-nowrap text-(--text-secondary)">
                                 {{ formatExpiry(item.expiresAt, t) }}
                              </div>
                         </div>
                     </div>
                </div>
                <div v-else class="flex h-32 items-center justify-center text-sm text-(--text-secondary)">
                    {{ t('dashboard.noActiveShares') }}
                </div>
                 <template #footer>
                    <AppButton
                      variant="ghost"
                      block
                      size="sm"
                      :text="t('dashboard.viewMore') + ' →'"
                      @click="showShareManager = true"
                    />
                 </template>
            </AppCard>

            <!-- Recent Files -->
            <AppCard
              indicator="cyan"
              padding="p-0"
              class="animate-fade-in-up"
              style="animation-delay: 600ms"
            >
              <template #header>
                <h3 class="font-semibold text-(--text-main)">
                  {{ t('dashboard.recentFiles') }}
                </h3>
              </template>

                <div v-if="recentFiles.length > 0" class="flex-1">
                     <!-- Desktop Table -->
                     <div class="hidden lg:block">
                         <AppTable
                             :columns="recentFilesColumns"
                             :data="recentFiles"
                         >
                             <template #cell-name="{ row }">
                                <div class="flex items-center gap-3">
                                    <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-bg)] text-xs font-bold text-[var(--color-primary)] uppercase ring-1 ring-[var(--color-primary-light)] ring-inset">
                                       {{ row.type || getFileExtension(row.name) }}
                                   </div>
                                   <span class="max-w-[200px] truncate text-[var(--text-main)]" :title="row.name">{{ row.name }}</span>
                               </div>
                             </template>
                             <template #cell-size="{ row }">
                                 <span class="font-mono">{{ formatSize(row.size) }}</span>
                             </template>
                             <template #cell-timestamp="{ row }">
                                 <span class="text-[var(--text-muted)]">{{ formatDate(row.timestamp) }}</span>
                             </template>
                         </AppTable>
                     </div>

                      <!-- Mobile List -->
                      <div class="divide-y divide-[var(--border-color)]/30 lg:hidden">
                          <div v-for="(file, index) in recentFiles" :key="index" class="flex items-center gap-4 p-4 hover:bg-[var(--bg-hover)]">
                              <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-bg)] text-xs font-bold text-[var(--color-primary)] uppercase ring-1 ring-[var(--color-primary-light)] ring-inset">
                                   {{ file.type || getFileExtension(file.name) }}
                              </div>
                              <div class="min-w-0 flex-1">
                                  <div class="truncate text-sm font-medium text-[var(--text-main)]">{{ file.name }}</div>
                                  <div class="mt-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                      <span class="font-mono text-[var(--text-muted)]">{{ formatSize(file.size) }}</span>
                                      <span>·</span>
                                      <span>{{ formatDate(file.timestamp) }}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                </div>
                 <div v-else class="flex h-32 items-center justify-center text-sm text-[var(--text-secondary)]">
                    {{ t('dashboard.noRecentFiles') }}
                </div>
                 <template #footer>
                    <AppButton
                      variant="ghost"
                      block
                      size="sm"
                      :text="t('dashboard.viewAll') + ' →'"
                      @click="router.push('/admin/files')"
                    />
                 </template>
            </AppCard>
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
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { useOrders } from '@/composables/useOrders';
import { useClipboard } from '@/composables/useClipboard';
import ShareManagementModal from '@/components/ShareManagementModal.vue';
 import ShareFolderModal from '@/components/ShareFolderModal.vue';
import Modal from '@/components/ui/Modal.vue';
import OrderDetail from '@/components/order/OrderDetail.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppStatCard from '@/components/ui/AppStatCard.vue';
import AppTable from '@/components/ui/AppTable.vue';
import {
  formatSize,
  formatDate,
  formatExpiry,
  getFileExtension,
  formatRelativeTime,
} from '@/utils/formatters';
import { API } from '@/utils/constants';

const router = useRouter();
const { authFetchJson } = useAuth();
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

const recentSharesColumns = computed(() => [
  { key: 'name', label: t('dashboard.folder') },
  { key: 'expiresAt', label: t('dashboard.expiry') },
]);

const recentFilesColumns = computed(() => [
  { key: 'name', label: t('dashboard.name') },
  { key: 'size', label: t('dashboard.size') },
  { key: 'timestamp', label: t('dashboard.uploadTime') },
]);

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

const handleEditUpdated = () => {
  fetchRecentShares();
  // Maybe also refresh manager if open? Manager does its own fetch on open.
};

const handleManagerEdit = (item) => {
  // Called from View More Modal
  editingFolder.value = item;
  showEditShare.value = true;
};

// const revokeShare = (item) => { ... } (Removed logic as requested/unused)

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
