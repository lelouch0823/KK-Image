<template>
  <div class="relative min-h-screen w-full overflow-hidden bg-(--bg-page) font-sans text-(--text-secondary) transition-colors duration-300">
    <!-- Fixed Background Gradient Mesh -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <!-- Top Left Blob -->
      <div class="bg-primary/5 absolute -top-[10%] -left-[10%] size-[50%] rounded-full blur-[120px] dark:bg-primary/10"></div>
      <!-- Top Right Blob -->
      <div class="absolute top-[20%] right-[10%] size-[40%] rounded-full bg-purple-500/5 blur-[120px] dark:bg-purple-500/10"></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 px-4 py-8 sm:px-6 lg:px-8">
      <DashboardShell :title="t('dashboard.title')" :description="dashboardDescription">
        <template #actions>
          <AppButton
            variant="secondary"
            :text="t('common.refresh')"
            :loading="isRefreshing"
            @click="handleRefresh"
          >
            <template #icon-left>
              <AppIcon name="arrow-path" class="size-4" />
            </template>
          </AppButton>
        </template>

        <template #summary>
          <div v-if="dashboardErrorCode === 'FORBIDDEN'" class="mb-8">
            <PermissionDeniedState
              :reason="dashboardError"
              home-to="/admin/forbidden"
              home-text="查看权限说明"
              @retry="fetchDashboardData"
            />
          </div>

          <StatGroup v-else :columns="4">
            <AppStatCard
              v-for="card in summaryCards"
              :key="card.key"
              :label="card.label"
              :value="card.value"
              :variant="card.variant"
            >
              <template #icon>
                <AppIcon :name="card.icon" class="size-5" />
              </template>
              <template #footer>
                <div class="flex items-center gap-2 text-xs text-(--text-secondary)">
                  <span v-if="card.footer">{{ card.footer }}</span>
                  <span v-if="card.meta" :class="card.metaClass">{{ card.meta }}</span>
                </div>
              </template>
            </AppStatCard>
          </StatGroup>
        </template>

        <template #main>

      <!-- Main Layout -->
      <div v-if="dashboardErrorCode !== 'FORBIDDEN'" class="grid h-full grid-cols-1 gap-6 pb-8 lg:grid-cols-12">
        
        <!-- Pending Orders List (Left Column - 5 cols) -->
        <div class="flex flex-col gap-6 lg:col-span-5">
            <div class="flex h-full min-h-[400px] flex-col overflow-hidden rounded-2xl border border-(--border-subtle) bg-white/70 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-(--bg-card)/60 dark:shadow-lg">
                <div class="flex items-center justify-between border-b border-(--border-subtle) bg-(--bg-card) p-5 dark:border-white/5 dark:bg-(--bg-card)/50">
                    <div class="flex items-center gap-2">
                        <div class="size-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                        <h3 class="text-sm font-semibold text-(--text-main)">{{ t('dashboard.pendingOrders') }}</h3>
                    </div>
                    <span v-if="orderStats.pendingCount > 0" class="rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-500 dark:text-red-400">
                        {{ orderStats.pendingCount }}
                    </span>
                </div>
                
                <div class="custom-scrollbar flex-1 overflow-y-auto bg-(--bg-muted)/50 dark:bg-[#0f1219]/50">
                    <div v-if="orderStats.recentPendingOrders.length > 0" class="divide-y divide-(--border-subtle) dark:divide-white/5">
                        <div
                            v-for="order in orderStats.recentPendingOrders"
                            :key="order.id"
                            class="group cursor-pointer border-l-2 border-transparent p-4 transition-colors hover:border-indigo-500/50 hover:bg-(--bg-hover) dark:hover:bg-[#161b26]"
                            @click="viewOrder(order)"
                        >
                            <div class="mb-1 flex items-start justify-between">
                                <span class="text-primary font-mono text-xs font-medium group-hover:text-primary/80">
                                    {{ order.orderNo }}
                                </span>
                                <span class="rounded border border-(--border-subtle) bg-white px-1.5 py-0.5 text-[10px] text-(--text-secondary) dark:border-white/5 dark:bg-[#1a202c] dark:text-slate-500">
                                    {{ formatRelativeTime(order.createdAt, t) }}
                                </span>
                            </div>
                            <div class="mb-2 text-xs text-(--text-secondary)">{{ order.name }}</div>
                            
                            <!-- Visual Progress Bar -->
                            <div class="flex items-center gap-2">
                                <div class="h-1 w-16 overflow-hidden rounded-full bg-(--bg-secondary) dark:bg-[#1f2937]">
                                    <div class="h-full w-1/3 bg-red-500/80 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div> 
                                </div>
                                <span class="text-[10px] font-bold tracking-wider text-(--text-muted) uppercase">{{ t('dashboard.awaitingAction') }}</span>
                            </div>
                        </div>
                    </div>
                    <div v-else class="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-(--text-secondary)">
                         <div class="flex flex-col items-center gap-2">
                             <AppIcon name="check-circle" class="size-8 text-(--text-muted) opacity-50" />
                             {{ t('dashboard.noPendingOrders') }}
                         </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="border-t border-(--border-subtle) bg-(--bg-card) p-4 text-center dark:border-white/5 dark:bg-(--bg-card)/50">
                    <router-link to="/orders?status=pending" class="text-primary flex w-full items-center justify-center gap-1 text-xs font-medium transition-colors hover:text-primary/80">
                        {{ t('dashboard.viewAllPending') }}
                        <AppIcon name="arrow-right" class="size-3.5" />
                    </router-link>
                </div>
            </div>
        </div>

        <!-- Right Column (7 cols): Shared Links & Recent Files -->
        <div class="flex flex-col gap-6 lg:col-span-7">
            
            <!-- Shared Links Card -->
            <div class="relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-(--border-subtle) bg-white/70 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-(--bg-card)/60 dark:shadow-lg">
                <div class="pointer-events-none absolute top-0 right-0 size-64 rounded-full bg-purple-500/5 blur-3xl dark:bg-purple-900/10"></div>
                <div class="flex items-center gap-2 border-b border-(--border-subtle) bg-(--bg-card) p-5 dark:border-white/5 dark:bg-(--bg-card)/50">
                    <div class="size-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                    <h3 class="text-sm font-semibold text-(--text-main)">{{ t('dashboard.recentShares') }}</h3>
                </div>

                <div v-if="recentShares.length === 0" class="flex flex-1 flex-col items-center justify-center bg-(--bg-muted)/30 p-10 text-center dark:bg-[#0f1219]/30">
                    <div class="mb-4 flex size-16 items-center justify-center rounded-full border border-(--border-subtle) bg-(--bg-card) shadow-inner dark:border-white/5 dark:bg-[#151921]">
                        <AppIcon name="no-symbol" class="size-8 text-(--text-muted)" />
                    </div>
                    <h4 class="mb-1 text-base font-medium text-(--text-main)">{{ t('dashboard.noActiveShares') }}</h4>
                    <p class="mx-auto max-w-xs text-xs text-(--text-secondary)">{{ t('dashboard.noActiveSharesDesc') }}</p>
                    <AppButton
                        variant="primary"
                        class="mt-6"
                        :text="t('dashboard.shareFile')"
                        @click="showShareManager = true"
                    />
                </div>
                
                <div v-else class="flex-1 overflow-auto bg-(--bg-muted)/30 dark:bg-[#0f1219]/30">
                     <!-- List for Shares -->
                     <ul class="divide-y divide-(--border-subtle) dark:divide-white/5">
                        <li v-for="item in recentShares" :key="item.id" class="flex items-center justify-between p-4 transition-colors hover:bg-(--bg-hover) dark:hover:bg-[#161b26]">
                            <div class="flex items-center gap-3">
                                <div class="flex size-8 items-center justify-center rounded border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                    <AppIcon name="folder" class="size-4.5" />
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-(--text-main)">{{ item.name }}</div>
                                    <div class="hover:text-primary dark:hover:text-primary/80 cursor-pointer font-mono text-[10px] text-(--text-secondary)" @click="handleCopyShareLink(item)">
                                        {{ item.shareToken }}
                                    </div>
                                </div>
                            </div>
                            <div class="rounded border border-(--border-subtle) bg-white px-2 py-1 text-[10px] text-(--text-secondary) dark:border-white/5 dark:bg-[#1a202c]">
                                {{ formatExpiry(item.expiresAt, t) }}
                            </div>
                        </li>
                     </ul>
                </div>

                <div class="border-t border-(--border-subtle) bg-(--bg-card) p-3 text-center dark:border-white/5 dark:bg-[#11141d]">
                    <AppButton
                        variant="secondary"
                        class="text-primary w-full border-none! bg-transparent! hover:text-primary/80"
                        size="sm"
                        :text="t('dashboard.viewHistory')"
                        @click="showShareManager = true"
                    >
                        <template #append>
                            <AppIcon name="arrow-right" class="size-3.5" />
                        </template>
                    </AppButton>
                </div>
            </div>

            <!-- Recent Files Card -->
            <div class="relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-(--border-subtle) bg-white/70 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-(--bg-card)/60 dark:shadow-lg">
                <div class="pointer-events-none absolute bottom-0 left-0 size-64 rounded-full bg-cyan-500/5 blur-3xl dark:bg-cyan-900/10"></div>
                <div class="flex items-center gap-2 border-b border-(--border-subtle) bg-(--bg-card) p-5 dark:border-white/5 dark:bg-(--bg-card)/50">
                    <div class="size-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                    <h3 class="text-sm font-semibold text-(--text-main)">{{ t('dashboard.recentFiles') }}</h3>
                </div>

                <div v-if="recentFiles.length === 0" class="flex flex-1 flex-col items-center justify-center bg-(--bg-muted)/30 p-10 text-center dark:bg-[#0f1219]/30">
                    <div class="mb-4 flex size-16 items-center justify-center rounded-full border border-(--border-subtle) bg-(--bg-card) shadow-inner dark:border-white/5 dark:bg-[#151921]">
                        <AppIcon name="archive-box-x-mark" class="size-8 text-(--text-muted)" />
                    </div>
                    <h4 class="mb-1 text-base font-medium text-(--text-main)">{{ t('dashboard.noRecentFiles') }}</h4>
                    <p class="mx-auto max-w-xs text-xs text-(--text-secondary)">{{ t('dashboard.noRecentFilesDesc') }}</p>
                    <div class="pointer-events-none mt-8 grid w-full max-w-sm grid-cols-2 gap-4 opacity-30 blur-[1px]">
                        <div class="flex items-center gap-3 rounded-lg border border-(--border-subtle) bg-white p-3 dark:border-white/5 dark:bg-[#151921]">
                            <AppIcon name="document-text" class="size-5 text-blue-500 dark:text-blue-400" />
                            <div class="h-1.5 w-20 rounded bg-slate-200 dark:bg-slate-800"></div>
                        </div>
                        <div class="flex items-center gap-3 rounded-lg border border-(--border-subtle) bg-white p-3 dark:border-white/5 dark:bg-[#151921]">
                            <AppIcon name="photo" class="size-5 text-green-500 dark:text-green-400" />
                            <div class="h-1.5 w-16 rounded bg-slate-200 dark:bg-slate-800"></div>
                        </div>
                    </div>
                </div>

                <div v-else class="flex-1 overflow-auto bg-(--bg-muted)/30 dark:bg-[#0f1219]/30">
                    <!-- List for Files -->
                    <ul class="divide-y divide-(--border-subtle) dark:divide-white/5">
                        <li v-for="(file, index) in recentFiles" :key="index" class="flex items-center justify-between p-4 transition-colors hover:bg-(--bg-hover) dark:hover:bg-[#161b26]">
                            <div class="flex items-center gap-3 overflow-hidden">
                                <div class="shadow-glow-cyan flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cyan-500/20 bg-(--bg-card) text-xs font-bold text-cyan-600 uppercase dark:bg-[#1a202c] dark:text-cyan-400">
                                     <AppImage
                                       v-if="isImage(file)"
                                       :src="file.url"
                                       class="size-full"
                                       fit="cover"
                                     />
                                     <AppIcon v-else name="document-text" class="size-4.5" />
                                </div>
                                <div class="min-w-0">
                                    <div class="max-w-[150px] truncate text-sm font-medium text-(--text-main) sm:max-w-xs">{{ file.name }}</div>
                                    <div class="text-[10px] text-(--text-secondary)">{{ formatSize(file.size) }} • {{ formatDate(file.timestamp) }}</div>
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>

                <div class="border-t border-(--border-subtle) bg-(--bg-card) p-3 text-center dark:border-white/5 dark:bg-[#11141d]">
                    <AppButton
                        variant="secondary"
                        class="text-primary w-full border-none! bg-transparent! hover:text-primary/80"
                        size="sm"
                        :text="t('dashboard.browseAllFiles')"
                        @click="router.push('/admin/files')"
                    >
                        <template #append>
                            <AppIcon name="arrow-right" class="size-3.5" />
                        </template>
                    </AppButton>
                </div>
            </div>
        </div>
      </div>
        </template>

        <template #secondary>
          <footer v-if="dashboardErrorCode !== 'FORBIDDEN'" class="py-4 text-center text-[10px] text-(--text-muted)">
            {{ t('dashboard.footer') }}
          </footer>
        </template>
      </DashboardShell>
    </div>

    <!-- Modals -->
    <ShareManagementModal v-model="showShareManager" @edit="handleManagerEdit" />
    <ShareFolderModal
      v-model="showEditShare"
      :folder="editingFolder"
      @updated="handleEditUpdated"
    />
    <OrderWorkflowModal
      v-model:show="showDetailModal"
      :order="viewingOrder"
      :hydrating="detailHydrating"
      :hydration-error="detailHydrationError"
      :commenting="commenting"
      @close="closeDetailModal"
      @retry="() => viewingOrder?.id && viewOrder(viewingOrder)"
      @refresh="refreshOrderDetail"
      @comment="handleComment"
    />
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
import { ref, onMounted, onActivated, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { useOrders } from '@/composables/useOrders';
import { useClipboard } from '@/composables/useClipboard';
import { useAI } from '@/composables/useAI';
import ShareManagementModal from '@/components/ShareManagementModal.vue';
import ShareFolderModal from '@/components/ShareFolderModal.vue';
import OrderWorkflowModal from '@/components/order/OrderWorkflowModal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import {
  formatSize,
  formatDate,
  formatExpiry,
  formatRelativeTime,
  isImage,
} from '@/utils/formatters';
import { API } from '@/utils/constants';
import AppImage from '@/components/ui/AppImage.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppStatCard from '@/components/ui/AppStatCard.vue';
import DashboardShell from '@/design-system/patterns/DashboardShell.vue';
import StatGroup from '@/design-system/composed/StatGroup.vue';
import Chart from 'chart.js/auto';

const router = useRouter();
const { authFetchJson } = useAuth();
const { t } = useI18n();
const { getOrder, addComment } = useOrders();
const { copyShareLink } = useClipboard();
const { setContext } = useAI();
const isRefreshing = ref(false);
const lastUpdatedTime = ref(new Date().toLocaleTimeString());
const dashboardErrorCode = ref(null);
const dashboardError = ref('');

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

const weekTrend = computed(() => {
  const current = orderStats.value.weekCount || 0;
  const last = orderStats.value.lastWeekCount || 0;
  if (last === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - last) / last) * 100);
});

const dashboardDescription = computed(() => {
  return `${t('dashboard.liveStatus')} · ${t('dashboard.lastUpdated')}: ${lastUpdatedTime.value}`;
});

const summaryCards = computed(() => [
  {
    key: 'today',
    label: t('dashboard.todayOrders'),
    value: orderStats.value.todayCount,
    variant: 'info',
    icon: 'clock',
    footer: t('dashboard.liveStatus'),
    meta: `+12% ${t('dashboard.vsYesterday')}`,
    metaClass: 'text-success',
  },
  {
    key: 'pending',
    label: t('dashboard.pendingOrders'),
    value: orderStats.value.pendingCount,
    variant: 'danger',
    icon: 'exclamation-circle',
    footer: t('dashboard.actionNeeded'),
    meta: '',
    metaClass: '',
  },
  {
    key: 'week',
    label: t('dashboard.weekOrders'),
    value: orderStats.value.weekCount || 0,
    variant: 'success',
    icon: 'chart-bar',
    footer: weekTrend.value === 0 ? t('dashboard.trendSame') : '',
    meta: weekTrend.value === 0 ? '' : `${weekTrend.value > 0 ? '↑' : '↓'} ${Math.abs(weekTrend.value)}%`,
    metaClass: weekTrend.value > 0 ? 'text-success' : 'text-danger',
  },
  {
    key: 'shares',
    label: t('dashboard.activeShares'),
    value: orderStats.value.activeSharesCount || 0,
    variant: 'purple',
    icon: 'share',
    footer: t('dashboard.acrossProjects'),
    meta: '',
    metaClass: '',
  },
]);

const showShareManager = ref(false);
const showEditShare = ref(false);
const editingFolder = ref(null);

const showDetailModal = ref(false);
const viewingOrder = ref(null);
const commenting = ref(false);
const detailHydrating = ref(false);
const detailHydrationError = ref('');

const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

// Chart Instances
let charts = {};

// Order Management
const viewOrder = async (order) => {
  viewingOrder.value = order ? { ...order } : null;
  showDetailModal.value = true;
  detailHydrationError.value = '';
  detailHydrating.value = true;
  try {
    const fullOrder = await getOrder(order.id);
    if (fullOrder) {
      viewingOrder.value = fullOrder;
      return true;
    }
    detailHydrationError.value = t('common.loadFailed');
    return false;
  } catch (_e) {
    detailHydrationError.value = t('common.networkError');
    return false;
  } finally {
    detailHydrating.value = false;
  }
};

const closeDetailModal = () => {
  showDetailModal.value = false;
  viewingOrder.value = null;
  detailHydrationError.value = '';
  detailHydrating.value = false;
  fetchDashboardData();
};

const refreshOrderDetail = async () => {
  if (viewingOrder.value) {
    detailHydrationError.value = '';
    detailHydrating.value = true;
    try {
      const fullOrder = await getOrder(viewingOrder.value.id);
      if (fullOrder) {
        viewingOrder.value = fullOrder;
      } else {
        detailHydrationError.value = t('common.loadFailed');
      }
    } catch (_e) {
      detailHydrationError.value = t('common.networkError');
    } finally {
      detailHydrating.value = false;
    }
  }
  fetchDashboardData();
  
  // Reload the order detail to show new comments if we are still viewing
  if (viewingOrder.value) {
    const fullOrder = await getOrder(viewingOrder.value.id);
    if (fullOrder) viewingOrder.value = fullOrder;
  }
};

const handleComment = async (comment) => {
  if (!viewingOrder.value || !comment.trim() || commenting.value) return;
  
  commenting.value = true;
  try {
    const success = await addComment(viewingOrder.value.id, comment);
    if (success) {
      await refreshOrderDetail();
    }
  } finally {
    commenting.value = false;
  }
};

// Data Fetching
const fetchDashboardData = async () => {
  try {
    dashboardErrorCode.value = null;
    dashboardError.value = '';
    const res = await authFetchJson(API.MANAGE_DASHBOARD_OVERVIEW);
    if (res.success && res.data) {
      orderStats.value = res.data;
      
      // Update Lists
      if (res.data.recentFiles) {
        recentFiles.value = res.data.recentFiles;
      }
      if (res.data.recentShares) {
        recentShares.value = res.data.recentShares;
      }

      // Update Charts
      if (res.data.charts) {
          if (Object.keys(charts).length > 0) {
              updateCharts(res.data.charts);
          } else {
             // If charts not initialized but we have data, we might be in early stage.
             // initCharts calls updateCharts eventually.
          }
      }
      
      lastUpdatedTime.value = new Date().toLocaleTimeString();
    }
  } catch (e) {
    const status = Number(e?.status);
    if (status === 403) {
      dashboardErrorCode.value = 'FORBIDDEN';
      dashboardError.value = e?.data?.error || e?.message || '权限不足';
      return;
    }
    dashboardErrorCode.value = 'ERROR';
    dashboardError.value = e?.data?.error || e?.message || '加载失败';
    console.error('Dashboard data load failed', e);
  }
};

const handleRefresh = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  await fetchDashboardData();
  setTimeout(() => {
    isRefreshing.value = false;
  }, 500);
};

const handleCopyShareLink = async (item) => {
  await copyShareLink(item.shareUrl, { successMessage: t('dashboard.linkCopied') });
};

const handleManagerEdit = (item) => {
  editingFolder.value = item;
  showEditShare.value = true;
};

const handleEditUpdated = () => {
  fetchDashboardData();
};

// Charts Logic
const updateCharts = (data) => {
    const processTrend = (trendData, type) => {
        const labels = [];
        const values = [];
        
        if (type === 'hourly') {
            const map = {};
            trendData.forEach(item => map[item.hour] = item.count);
            for (let i = 0; i < 24; i++) {
                const hour = i.toString().padStart(2, '0');
                labels.push(hour);
                values.push(map[hour] || 0);
            }
        } else {
            const map = {};
            trendData.forEach(item => map[item.date] = item.count);
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                labels.push(dateStr.slice(5));
                values.push(map[dateStr] || 0);
            }
        }
        return { labels, values };
    };

    const updateChart = (id, processedData) => {
        if (charts[id]) {
            charts[id].data.labels = processedData.labels;
            charts[id].data.datasets[0].data = processedData.values;
            charts[id].update();
        }
    };

    if (data.today) updateChart('chart1', processTrend(data.today, 'hourly'));
    if (data.pending) updateChart('chart2', processTrend(data.pending, 'daily'));
    if (data.week) updateChart('chart3', processTrend(data.week, 'daily'));
    if (data.shares) updateChart('chart4', processTrend(data.shares, 'daily'));
};

const initCharts = () => {
    const createChart = (id, color, data, labels) => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        
        if (charts[id]) {
            charts[id].destroy();
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 50);
        gradient.addColorStop(0, color.replace('1)', '0.3)')); 
        gradient.addColorStop(1, color.replace('1)', '0.0)'));
        
        charts[id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels || ['1', '2', '3', '4', '5', '6', '7'],
                datasets: [{
                    data: data,
                    borderColor: color,
                    borderWidth: 2,
                    backgroundColor: gradient,
                    fill: true,
                    pointRadius: 0,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } },
                animation: { duration: 1000 }
            }
        });
    };

    createChart('chart1', 'rgba(59, 130, 246, 1)', [], []);
    createChart('chart2', 'rgba(248, 113, 113, 1)', [], []);
    createChart('chart3', 'rgba(16, 185, 129, 1)', [], []);
    createChart('chart4', 'rgba(168, 85, 247, 1)', [], []);
    
    // Check if we have data in orderStats from fetchDashboardData (which might have finished before nextTick)
    if (orderStats.value && orderStats.value.charts) {
        updateCharts(orderStats.value.charts);
    }
};

onMounted(async () => {
  await fetchDashboardData();
  nextTick(() => {
    initCharts();
  });
});

onActivated(() => {
  fetchDashboardData();
  nextTick(() => {
    initCharts();
  });
});

watch([showDetailModal, viewingOrder], ([isOpen, order]) => {
  if (isOpen && order?.id) {
    setContext({
      selectedId: order.id,
      selectedType: 'order',
    });
    return;
  }
  setContext({
    selectedId: null,
    selectedType: null,
  });
});
</script>

<style scoped>
.custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) transparent;
}
</style>
