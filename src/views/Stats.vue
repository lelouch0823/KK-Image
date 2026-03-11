<template>
  <div class="relative min-h-screen w-full overflow-hidden bg-(--bg-page) text-(--text-main) transition-colors duration-300">
    <!-- Background Gradient Mesh -->
    <div class="pointer-events-none fixed inset-0 z-0">
      <div
        class="bg-info/20 absolute -top-[20%] -left-[10%] size-[800px] animate-pulse rounded-full blur-[120px]"
      ></div>
      <div
        class="absolute top-[20%] right-[0%] size-[600px] animate-pulse rounded-full bg-purple-500/20 blur-[100px]"
        style="animation-delay: 2s"
      ></div>
      <div
        class="bg-success/20 absolute -bottom-[20%] left-[20%] size-[600px] animate-pulse rounded-full blur-[100px]"
        style="animation-delay: 4s"
      ></div>
      <!-- Grid Overlay -->
      <div
        class="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-size-[40px_40px] opacity-20 dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]"
      ></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 px-6 py-8 sm:px-10">
      <DashboardShell :title="t('stats.statusOverview')" :description="t('ai.subtitle')">
        <template #actions>
          <AppButton
            variant="outline"
            :loading="loading"
            :text="t('common.refresh')"
            @click="loadStats"
          >
            <template #icon-left>
              <AppIcon name="arrow-path" class="size-4" />
            </template>
          </AppButton>
        </template>

        <template #main>

      <!-- Loading State -->
      <div v-if="loading && !stats" class="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Skeleton v-for="i in 3" :key="i" template="stat-card" />
        <Skeleton class="h-[400px] lg:col-span-2" />
        <Skeleton class="h-[400px]" />
      </div>

      <div v-else-if="errorCode === 'FORBIDDEN'" class="flex h-96 flex-col items-center justify-center">
        <PermissionDeniedState
          title="统计分析权限不足"
          :description="error || '当前账号没有统计读取权限，请联系管理员分配 stats:read。'"
          required-permission="stats:read"
          @retry="loadStats"
        />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex h-96 flex-col items-center justify-center gap-4 text-center">
        <div class="bg-danger/10 text-danger ring-danger/20 flex size-20 items-center justify-center rounded-full ring-1">
          <AppIcon name="exclamation-triangle" class="size-10" />
        </div>
        <h3 class="text-xl font-semibold text-(--text-main)">{{ t('stats.loadFailed') }}</h3>
        <p class="max-w-md text-(--text-secondary)">{{ error }}</p>
        <AppButton
          variant="primary"
          class="mt-2"
          :text="t('stats.retry')"
          @click="loadStats"
        />
      </div>

      <!-- Dashboard Content -->
      <div v-else-if="stats" class="animate-fade-in-up grid gap-6">
        
        <!-- Key Metrics Row -->
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <!-- Total Files -->
          <AppStatCard
            :label="t('stats.totalFiles')"
            :value="stats.storage?.totalFiles"
            variant="info"
            glow
          >
            <template #icon>
              <AppIcon name="document-text" class="size-6" />
            </template>
            <template #footer>
              <div class="flex items-center gap-2 text-sm font-medium text-(--text-secondary)">
                <StatusBadge variant="success" class="!px-2 !py-0.5">+{{ formatNumber(stats.storage?.todayUploads) }}</StatusBadge>
                {{ t('dashboard.todayOrders') }}
              </div>
            </template>
          </AppStatCard>

          <!-- Total Storage -->
          <AppStatCard
            :label="t('stats.totalStorage')"
            :value="formatSize(stats.storage?.totalSize)"
            variant="success"
            glow
          >
            <template #icon>
              <AppIcon name="database" class="size-6" />
            </template>
            <template #footer>
              <div class="text-sm font-medium text-(--text-secondary)">
                {{ t('stats.totalStorage') }}
              </div>
            </template>
          </AppStatCard>

          <!-- Monthly Visits -->
          <AppStatCard
            :label="t('stats.monthVisits')"
            :value="stats.traffic?.monthTotal"
            variant="purple"
            glow
          >
            <template #icon>
              <AppIcon name="eye" class="size-6" />
            </template>
            <template #footer>
              <div class="text-sm font-medium text-(--text-secondary)">
                {{ t('stats.trafficTrend') }}
              </div>
            </template>
          </AppStatCard>
        </div>

        <!-- Charts Area -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- Traffic Trend -->
          <AppCard
             class="lg:col-span-2"
             :indicator="'info'"
          >
            <template #header>
              <h3 class="font-semibold text-(--text-main)">
                {{ t('stats.trafficTrend') }}
              </h3>
            </template>
            <div class="relative h-80">
              <canvas ref="trendChartRef"></canvas>
            </div>
          </AppCard>

          <!-- File Distribution -->
          <AppCard
             :indicator="'teal'"
          >
            <template #header>
              <h3 class="font-semibold text-(--text-main)">
                {{ t('stats.fileTypes') }}
              </h3>
            </template>
            <div class="relative h-80">
              <canvas ref="typeChartRef"></canvas>
            </div>
          </AppCard>
        </div>

        <!-- Bottom Grid -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- Top Spaces -->
            <AppCard
                indicator="orange"
            >
              <template #header>
                <h3 class="font-semibold text-(--text-main)">
                  {{ t('stats.topSpaces') }}
                </h3>
              </template>
              <div v-if="stats.traffic?.topSpaces?.length > 0" class="space-y-4">
                <div
                    v-for="(space, index) in stats.traffic?.topSpaces"
                    :key="space.id"
                    class="group flex items-center justify-between rounded-xl border border-transparent bg-(--bg-muted) p-4 transition-all hover:border-primary/20 hover:bg-primary/5"
                >
                    <div class="flex items-center gap-4">
                        <div 
                          class="flex size-10 items-center justify-center rounded-lg text-lg font-bold"
                           :class="{
                            'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg shadow-orange-500/20': index === 0,
                            'bg-(--bg-card) text-(--text-secondary)': index > 0
                          }"
                        >
                            {{ index + 1 }}
                        </div>
                        <div>
                           <div class="group-hover:text-primary font-medium text-(--text-main) transition-colors">{{ space.name }}</div>
                            <div class="mt-1 text-xs text-(--text-muted)">ID: {{ space.id.slice(0,8) }}</div>
                        </div>
                    </div>
                    
                    <div class="text-right">
                         <div class="font-mono text-xl font-bold text-(--text-main)">{{ formatNumber(space.views) }}</div>
                         <div class="text-xs tracking-wider text-(--text-muted) uppercase">{{ t('stats.views') }}</div>
                    </div>
                </div>
              </div>
               <div v-else class="flex h-40 items-center justify-center text-(--text-muted)">
                    {{ t('stats.noData') }}
                </div>
            </AppCard>

            <!-- Health Status -->
            <AppCard
                indicator="pink"
            >
                 <template #header>
                  <h3 class="relative font-semibold text-(--text-main)">
                    {{ t('stats.statusOverview') }}

                  </h3>
                </template>
                 <div class="align-content-start grid h-full grid-cols-2 gap-4">
                     <!-- Normal -->
                     <div class="border-success/20 bg-success/10 rounded-xl border p-5 backdrop-blur-sm transition-transform hover:scale-[1.02]">
                         <div class="text-success mb-2 text-sm font-medium">{{ t('stats.normal') }}</div>
                         <div class="text-success font-mono text-3xl font-bold">{{ formatNumber(stats.health?.status?.normal) }}</div>
                          <div class="bg-success/20 mt-2 h-1 w-full rounded-full">
                             <div class="bg-success h-full rounded-full transition-all duration-1000" style="width: 100%"></div>
                          </div>
                     </div>
                      <!-- Blocked -->
                      <div class="border-danger/20 bg-danger/10 rounded-xl border p-5 backdrop-blur-sm transition-transform hover:scale-[1.02]">
                         <div class="text-danger mb-2 text-sm font-medium">{{ t('stats.blocked') }}</div>
                         <div class="text-danger font-mono text-3xl font-bold">{{ formatNumber(stats.health?.status?.blocked) }}</div>
                          <div class="bg-danger/20 mt-2 h-1 w-full rounded-full">
                             <div class="bg-danger h-full rounded-full transition-all duration-1000" :style="`width: ${stats.health?.status?.blocked > 0 ? '100%' : '0%'}`"></div>
                          </div>
                     </div>
                      <!-- Whitelisted -->
                      <div class="border-info/20 bg-info/10 rounded-xl border p-5 backdrop-blur-sm transition-transform hover:scale-[1.02]">
                         <div class="text-info mb-2 text-sm font-medium">{{ t('stats.whitelisted') }}</div>
                         <div class="text-info font-mono text-3xl font-bold">{{ formatNumber(stats.health?.status?.whitelisted) }}</div>
                     </div>
                     <!-- Liked -->
                     <div class="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-5 backdrop-blur-sm transition-transform hover:scale-[1.02]">
                         <div class="text-warning mb-2 text-sm font-medium">{{ t('stats.liked') }}</div>
                         <div class="font-mono text-3xl font-bold text-amber-600 dark:text-amber-400">{{ formatNumber(stats.health?.status?.liked) }}</div>
                     </div>
                 </div>
            </AppCard>
        </div>

        <!-- Large Files Table -->
        <AppCard
             indicator="indigo"
             padding="p-0"
        >
             <template #header>
              <h3 class="font-semibold text-(--text-main)">
                {{ t('stats.largeFiles') }}
              </h3>
            </template>
             <div v-if="stats.storage?.largeFiles?.length > 0">
               <AppTable
                 :columns="largeFilesColumns"
                 :data="stats.storage?.largeFiles"
               >
                 <template #cell-name="{ row, index }">
                    <div class="flex items-center gap-2">
                        <span class="line-clamp-1 max-w-[200px] md:max-w-md">{{ row.name }}</span>
                        <StatusBadge v-if="index < 3" variant="danger">Hot</StatusBadge>
                    </div>
                 </template>
                 <template #cell-type="{ row }">
                    <span class="inline-flex items-center rounded-md bg-(--bg-muted) px-2 py-1 text-xs font-medium text-(--text-secondary) ring-1 ring-(--border-color) ring-inset">
                        {{ row.type?.split('/')[1]?.toUpperCase() || 'UNKNOWN' }}
                    </span>
                 </template>
                 <template #cell-index="{ index }">
                   <span class="text-(--text-secondary)">{{ index + 1 }}</span>
                 </template>
                 <template #cell-size="{ row }">
                   <span class="text-warning font-mono">{{ formatSize(row.size) }}</span>
                 </template>
               </AppTable>
              </div>
               <div v-else class="flex h-32 items-center justify-center text-(--text-muted)">
                    {{ t('stats.noData') }}
                </div>
        </AppCard>
      </div>
        </template>
      </DashboardShell>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, nextTick, onUnmounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { formatSize } from '@/utils/formatters';
import { API } from '@/utils/constants';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import AppCard from '@/components/ui/AppCard.vue';
import AppStatCard from '@/components/ui/AppStatCard.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppButton from '@/components/ui/AppButton.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import DashboardShell from '@/design-system/patterns/DashboardShell.vue';

// Configure Chart.js defaults
const configureChartDefaults = () => {
  const isDark = document.documentElement.classList.contains('dark');
  Chart.defaults.color = isDark ? '#94a3b8' : '#64748b'; // Slate-400 : Slate-500
  Chart.defaults.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
};
configureChartDefaults();

const { addToast } = useToast();
const { authFetch } = useAuth();
const { t } = useI18n();

// --- State ---
const loading = ref(true);
const error = ref('');
const errorCode = ref(null);
const stats = ref(null);
const trendChartRef = ref(null);
const typeChartRef = ref(null);

let trendChartInstance = null;
let typeChartInstance = null;

const largeFilesColumns = computed(() => [
  { key: 'index', label: '#', width: '60px' },
  { key: 'name', label: t('stats.fileName') },
  { key: 'type', label: t('stats.fileType') },
  { key: 'size', label: t('stats.fileSize'), align: 'right' },
]);

// 格式化数字
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || '0';
};

const createCharts = () => {
  if (!stats.value) return;

  // Destroy Old
  if (trendChartInstance) trendChartInstance.destroy();
  if (typeChartInstance) typeChartInstance.destroy();

  // 1. Traffic Trend Chart
  if (trendChartRef.value) {
    const ctx = trendChartRef.value.getContext('2d');
    const dailyData = stats.value.traffic?.daily || {};
    
    // Safety check: if no data, ensure we don't error out
    const labels = Object.keys(dailyData);
    const data = Object.values(dailyData);

    // Gradient Fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // Blue-500
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: t('stats.monthVisits'),
            data: data,
            borderColor: '#60a5fa', // Blue-400
            backgroundColor: gradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4, // Smooth curve
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#2563eb',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)', 
                titleColor: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
                bodyColor: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#475569',
                borderColor: 'var(--border-color)',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
            }
        },
        scales: {
          x: { 
              grid: { display: false }, 
              ticks: { maxTicksLimit: 7, color: 'var(--text-secondary)' } 
          },
          y: {
            border: { display: false },
            grid: { color: 'var(--border-color)', opacity: 0.1 },
            beginAtZero: true,
            ticks: { color: 'var(--text-secondary)' }
          },
        },
        interaction: { intersect: false, mode: 'index' },
      },
    });
  }

  // 2. File Type Chart
  if (typeChartRef.value) {
    const ctx = typeChartRef.value.getContext('2d');
    const fileTypes = stats.value.health?.fileTypes || [];
    const typeData = fileTypes.slice(0, 5).map(i => ({ ...i })); // Shallow copy to avoid mutation issues
    
    // Calculate 'Other' only if we have more than 5 types
    if (fileTypes.length > 5) {
        const otherCount = fileTypes.slice(5).reduce((acc, cur) => acc + (cur.count || 0), 0);
        if (otherCount > 0) {
            typeData.push({ type: 'Other', count: otherCount });
        }
    }

    typeChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: typeData.map((i) => i.type.toUpperCase().split('/')[1] || i.type),
        datasets: [
          {
            data: typeData.map((i) => i.count),
            backgroundColor: [
                '#3b82f6', // blue
                '#10b981', // emerald
                '#8b5cf6', // violet
                '#f59e0b', // amber
                '#ec4899', // pink
                '#64748b'  // slate (other)
            ],
            borderWidth: 0,
            hoverOffset: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { 
              position: 'right', 
              labels: { 
                  usePointStyle: true, 
                  padding: 20,
                  color: 'var(--text-secondary)',
                  font: { size: 12 }
              } 
          },
          tooltip: {
                backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: 'var(--border-color)',
                borderWidth: 1,
          }
        },
      },
    });
  }
};

const loadStats = async () => {
  // Prevent concurrent loads if already loading (except initial true state)
  // Logic: If already loading and stats are null, it's the initial load.
  // If loading is true but called again, we can let it slide to debounce, or blocking?
  // Simplest for double-fetch fix: The caller should check loading.
  
  loading.value = true;
  error.value = '';
  errorCode.value = null;
  try {
    const response = await authFetch(API.STATS);
    if (!response.ok) throw new Error('API Request Failed');

    const json = await response.json();
    stats.value = json.data || json;
    
    // Smooth chart rendering
    await nextTick();
    // Wrap createCharts in try-catch to prevent UI crash
    try {
        setTimeout(createCharts, 100); 
    } catch (chartErr) {
        console.warn('Charts failed to render:', chartErr);
    }
    
    // addToast({ message: t('stats.refreshSuccess'), type: 'success' });
  } catch (err) {
    console.error(err);
    const status = Number(err?.status || 0);
    if (status === 403) {
      errorCode.value = 'FORBIDDEN';
      error.value = err?.data?.error || err?.message || t('common.error.forbidden') || '权限不足';
      return;
    }
    if (status === 401) {
      errorCode.value = 'UNAUTHORIZED';
      error.value = err?.data?.error || err?.message || t('common.error.unauthorized') || '未授权';
      return;
    }
    errorCode.value = 'NETWORK_ERROR';
    // Don't clear stats if refresh fails, just show error toast
    if (!stats.value) error.value = t('stats.loadError');
    addToast({ message: t('stats.loadError'), type: 'error' });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadStats();
  const timer = setInterval(loadStats, 300000); // 5 min
  onUnmounted(() => clearInterval(timer));
});

onActivated(() => {
  // Fix double invoke: Only load if not already loading and no data
  if (!stats.value && !loading.value) {
    loadStats();
  }
});

// Watch for theme changes to update charts
if (typeof window !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        configureChartDefaults();
        createCharts();
      }
    });
  });
  observer.observe(document.documentElement, { attributes: true });
  onUnmounted(() => observer.disconnect());
}
</script>

<style scoped>
/* Keyframes available via Tailwind v4 usually, but adding explicit for reliability */
@keyframes fade-in-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up {
    animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
