<template>
  <div class="min-h-screen bg-(--bg-page) px-4 py-8 text-(--text-secondary) sm:px-6 lg:px-8">
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
        <div v-if="dashboardErrorCode === ErrorCode.FORBIDDEN" class="mb-8">
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
        <div
          v-if="dashboardErrorCode !== ErrorCode.FORBIDDEN"
          class="grid h-full grid-cols-1 gap-6 pb-8 lg:grid-cols-12"
        >
          <div class="lg:col-span-5">
            <SurfaceSection
              class="flex h-full min-h-[400px] flex-col"
              body-class="flex flex-1 flex-col p-0"
            >
              <template #header>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-semibold text-(--text-main)">
                    {{ t('dashboard.pendingOrders') }}
                  </h3>
                  <StatusBadge variant="danger" dot>{{ t('dashboard.actionNeeded') }}</StatusBadge>
                </div>
              </template>
              <template #actions>
                <StatusBadge v-if="orderStats.pendingCount > 0" variant="danger">
                  {{ orderStats.pendingCount }}
                </StatusBadge>
              </template>

              <div class="custom-scrollbar flex-1 overflow-y-auto bg-(--bg-muted)/40">
                <div
                  v-if="orderStats.recentPendingOrders.length > 0"
                  class="divide-y divide-(--border-color)"
                >
                  <div
                    v-for="order in orderStats.recentPendingOrders"
                    :key="order.id"
                    class="group cursor-pointer border-l-2 border-transparent p-4 transition-all duration-200 hover:border-warning/50 hover:bg-(--bg-hover) hover:pl-5"
                    @click="viewOrder(order)"
                  >
                    <div class="mb-1 flex items-start justify-between gap-3">
                      <span class="text-primary font-mono text-xs font-medium">
                        {{ order.orderNo }}
                      </span>
                      <StatusBadge variant="neutral" outline>
                        {{ formatRelativeTime(order.createdAt, t) }}
                      </StatusBadge>
                    </div>
                    <div class="mb-2 text-xs text-(--text-secondary)">{{ order.name }}</div>
                    <div class="flex items-center gap-2">
                      <div class="h-1 w-16 overflow-hidden rounded-full bg-(--bg-muted)">
                        <div class="bg-warning h-full w-1/3"></div>
                      </div>
                      <span
                        class="text-[10px] font-bold tracking-wider text-(--text-muted) uppercase"
                      >
                        {{ t('dashboard.awaitingAction') }}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-else class="flex h-full items-center">
                  <EmptyState
                    icon="check-circle"
                    :title="t('dashboard.noPendingOrders')"
                    :description="t('dashboard.liveStatus')"
                    container-class="w-full py-12"
                  />
                </div>
              </div>

              <div class="border-t border-(--border-color) p-3">
                <AppButton
                  variant="ghost"
                  class="w-full justify-center"
                  size="sm"
                  :text="t('dashboard.viewAllPending')"
                  @click="router.push({ name: 'Orders', query: { status: 'pending' } })"
                >
                  <template #icon-right>
                    <AppIcon name="arrow-right" class="size-3.5" />
                  </template>
                </AppButton>
              </div>
            </SurfaceSection>
          </div>

          <div class="flex flex-col gap-6 lg:col-span-7">
            <SurfaceSection
              class="flex min-h-[300px] flex-col"
              body-class="flex flex-1 flex-col p-0"
            >
              <template #header>
                <div class="flex items-center gap-2">
                  <AppIcon name="share" class="size-4 text-primary" />
                  <h3 class="text-sm font-semibold text-(--text-main)">
                    {{ t('dashboard.recentShares') }}
                  </h3>
                </div>
              </template>

              <div v-if="recentShares.length === 0" class="flex flex-1 items-center">
                <EmptyState
                  icon="no-symbol"
                  :title="t('dashboard.noActiveShares')"
                  :description="t('dashboard.noActiveSharesDesc')"
                  container-class="w-full py-12"
                >
                  <template #action>
                    <AppButton
                      variant="primary"
                      class="mt-6"
                      :text="t('dashboard.shareFile')"
                      @click="showShareManager = true"
                    />
                  </template>
                </EmptyState>
              </div>

              <div v-else class="flex-1 overflow-auto bg-(--bg-muted)/20">
                <ul class="divide-y divide-(--border-color)">
                  <li
                    v-for="item in recentShares"
                    :key="item.id"
                    class="flex items-center justify-between gap-3 p-4 transition-all duration-200 hover:bg-(--bg-hover)"
                  >
                    <div class="flex min-w-0 items-center gap-3">
                      <div
                        class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--color-primary-bg) text-primary"
                      >
                        <AppIcon name="folder" class="size-4.5" />
                      </div>
                      <div class="min-w-0">
                        <div class="truncate text-sm font-medium text-(--text-main)">
                          {{ item.name }}
                        </div>
                        <AppButton
                          variant="link"
                          class="!text-(--text-secondary) hover:!text-primary font-mono text-[10px]"
                          @click="handleCopyShareLink(item)"
                        >
                          {{ item.shareToken }}
                        </AppButton>
                      </div>
                    </div>
                    <StatusBadge variant="neutral" outline>
                      {{ formatExpiry(item.expiresAt, t) }}
                    </StatusBadge>
                  </li>
                </ul>
              </div>

              <div class="border-t border-(--border-color) p-3">
                <AppButton
                  variant="ghost"
                  class="w-full justify-center"
                  size="sm"
                  :text="t('dashboard.viewHistory')"
                  @click="showShareManager = true"
                >
                  <template #icon-right>
                    <AppIcon name="arrow-right" class="size-3.5" />
                  </template>
                </AppButton>
              </div>
            </SurfaceSection>

            <SurfaceSection
              class="flex min-h-[300px] flex-col"
              body-class="flex flex-1 flex-col p-0"
            >
              <template #header>
                <div class="flex items-center gap-2">
                  <AppIcon name="document-text" class="size-4 text-info" />
                  <h3 class="text-sm font-semibold text-(--text-main)">
                    {{ t('dashboard.recentFiles') }}
                  </h3>
                </div>
              </template>

              <div v-if="recentFiles.length === 0" class="flex flex-1 items-center">
                <EmptyState
                  icon="archive-box-x-mark"
                  :title="t('dashboard.noRecentFiles')"
                  :description="t('dashboard.noRecentFilesDesc')"
                  container-class="w-full py-12"
                />
              </div>

              <div v-else class="flex-1 overflow-auto bg-(--bg-muted)/20">
                <ul class="divide-y divide-(--border-color)">
                  <li
                    v-for="(file, index) in recentFiles"
                    :key="index"
                    class="flex items-center justify-between gap-3 p-4 transition-all duration-200 hover:bg-(--bg-hover)"
                  >
                    <div class="flex min-w-0 items-center gap-3 overflow-hidden">
                      <div
                        class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-info/20 bg-(--color-info-bg) text-info text-xs font-bold uppercase"
                      >
                        <AppImage
                          v-if="isImage(file)"
                          :src="file.url"
                          :alt="file.name"
                          class="size-full"
                          fit="cover"
                        />
                        <AppIcon v-else name="document-text" class="size-4.5" />
                      </div>
                      <div class="min-w-0">
                        <div
                          class="max-w-[150px] truncate text-sm font-medium text-(--text-main) sm:max-w-xs"
                        >
                          {{ file.name }}
                        </div>
                        <div class="text-[10px] text-(--text-secondary)">
                          {{ formatSize(file.size) }} • {{ formatDate(file.timestamp) }}
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>

              <div class="border-t border-(--border-color) p-3">
                <AppButton
                  variant="ghost"
                  class="w-full justify-center"
                  size="sm"
                  :text="t('dashboard.browseAllFiles')"
                  @click="router.push('/admin/files')"
                >
                  <template #icon-right>
                    <AppIcon name="arrow-right" class="size-3.5" />
                  </template>
                </AppButton>
              </div>
            </SurfaceSection>
          </div>
        </div>
      </template>

      <template #secondary>
        <footer
          v-if="dashboardErrorCode !== ErrorCode.FORBIDDEN"
          class="border-t border-(--border-subtle) bg-(--bg-card) py-4 text-center text-xs text-(--text-muted)"
        >
          {{ t('dashboard.footer') }}
        </footer>
      </template>
    </DashboardShell>

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
import { ref, onMounted, onActivated, onBeforeUnmount, computed, watch, nextTick } from 'vue';
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
import EmptyState from '@/components/ui/EmptyState.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
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
import SurfaceSection from '@/design-system/composed/SurfaceSection.vue';
import DashboardShell from '@/design-system/patterns/DashboardShell.vue';
import StatGroup from '@/design-system/composed/StatGroup.vue';
import { Chart } from '@/utils/chart-setup';
import { ErrorCode } from '@/utils/error-codes';
import { classifyError, extractErrorMessage } from '@/utils/api-helpers';

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
    meta:
      weekTrend.value === 0
        ? ''
        : `${weekTrend.value > 0 ? '↑' : '↓'} ${Math.abs(weekTrend.value)}%`,
    metaClass: weekTrend.value > 0 ? 'text-success' : 'text-danger',
  },
  {
    key: 'shares',
    label: t('dashboard.activeShares'),
    value: orderStats.value.activeSharesCount || 0,
    variant: 'primary',
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
let detailRequestId = 0;

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
  const requestId = ++detailRequestId;
  viewingOrder.value = order ? { ...order } : null;
  showDetailModal.value = true;
  detailHydrationError.value = '';
  detailHydrating.value = true;
  try {
    const fullOrder = await getOrder(order.id);
    if (requestId !== detailRequestId || !showDetailModal.value) return false;
    if (fullOrder) {
      viewingOrder.value = fullOrder;
      return true;
    }
    detailHydrationError.value = t('common.loadFailed');
    return false;
  } catch (_e) {
    if (requestId !== detailRequestId || !showDetailModal.value) return false;
    detailHydrationError.value = t('common.networkError');
    return false;
  } finally {
    if (requestId === detailRequestId) {
      detailHydrating.value = false;
    }
  }
};

const closeDetailModal = () => {
  detailRequestId += 1;
  showDetailModal.value = false;
  viewingOrder.value = null;
  detailHydrationError.value = '';
  detailHydrating.value = false;
  fetchDashboardData();
};

const refreshOrderDetail = async () => {
  if (viewingOrder.value) {
    const requestId = ++detailRequestId;
    detailHydrationError.value = '';
    detailHydrating.value = true;
    try {
      const fullOrder = await getOrder(viewingOrder.value.id);
      if (requestId !== detailRequestId || !showDetailModal.value) return;
      if (fullOrder) {
        viewingOrder.value = fullOrder;
      } else {
        detailHydrationError.value = t('common.loadFailed');
      }
    } catch (_e) {
      if (requestId !== detailRequestId || !showDetailModal.value) return;
      detailHydrationError.value = t('common.networkError');
    } finally {
      if (requestId === detailRequestId) {
        detailHydrating.value = false;
      }
    }
  }
  fetchDashboardData();

  // Reload the order detail to show new comments if we are still viewing
  if (viewingOrder.value) {
    const requestId = ++detailRequestId;
    const fullOrder = await getOrder(viewingOrder.value.id);
    if (requestId !== detailRequestId || !showDetailModal.value) return;
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
let fetchPromise = null;

const _fetchDashboardData = async () => {
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
    const code = classifyError(e);
    if (code === ErrorCode.FORBIDDEN) {
      dashboardErrorCode.value = ErrorCode.FORBIDDEN;
      dashboardError.value = extractErrorMessage(e, t('common.error.forbidden'));
      return;
    }
    dashboardErrorCode.value = ErrorCode.NETWORK_ERROR;
    dashboardError.value = extractErrorMessage(e, t('common.loadFailed'));
    console.error('Dashboard data load failed', e);
  }
};

const fetchDashboardData = async () => {
  if (fetchPromise) return fetchPromise;
  try {
    fetchPromise = _fetchDashboardData();
    return await fetchPromise;
  } finally {
    fetchPromise = null;
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
      trendData.forEach((item) => (map[item.hour] = item.count));
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0');
        labels.push(hour);
        values.push(map[hour] || 0);
      }
    } else {
      const map = {};
      trendData.forEach((item) => (map[item.date] = item.count));
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

const resolveDashboardChartColor = (token, fallback) => {
  if (typeof document === 'undefined') {
    return `rgba(${fallback}, 1)`;
  }

  const color = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (color.startsWith('#') && color.length === 7) {
    const parsed = Number.parseInt(color.slice(1), 16);
    if (!Number.isNaN(parsed)) {
      const rgb = `${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255}`;
      return `rgba(${rgb}, 1)`;
    }
  }

  const matched = color.match(/\d+/g);
  if (matched?.length >= 3) {
    return `rgba(${matched.slice(0, 3).join(', ')}, 1)`;
  }

  return `rgba(${fallback}, 1)`;
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
        datasets: [
          {
            data: data,
            borderColor: color,
            borderWidth: 2,
            backgroundColor: gradient,
            fill: true,
            pointRadius: 0,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        animation: { duration: 1000 },
      },
    });
  };

  createChart('chart1', resolveDashboardChartColor('--color-info', '59, 130, 246'), [], []);
  createChart('chart2', resolveDashboardChartColor('--color-danger', '239, 68, 68'), [], []);
  createChart('chart3', resolveDashboardChartColor('--color-success', '16, 185, 129'), [], []);
  createChart('chart4', resolveDashboardChartColor('--color-primary', '236, 91, 19'), [], []);

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

onBeforeUnmount(() => {
  // 销毁所有 Chart.js 实例防止内存泄漏
  for (const chart of Object.values(charts)) {
    chart?.destroy?.();
  }
  charts = {};
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
