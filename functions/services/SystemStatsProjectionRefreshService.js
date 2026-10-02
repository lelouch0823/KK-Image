import { getChinaDayStart, getFileUrl } from '../_shared/utils.js';
import { FolderRepository } from '../repositories/FolderRepository.js';
import { OrderStatsRepository } from '../repositories/OrderStatsRepository.js';
import { StatsRepository } from '../repositories/StatsRepository.js';
import { SystemStatsProjectionRepository } from '../repositories/SystemStatsProjectionRepository.js';
import { MS_PER_DAY } from '../api/utils/constants.js';

export const STATS_PROJECTION_SCOPES = {
  MANAGE_STATS: 'manage.stats',
  DASHBOARD_OVERVIEW: 'manage.dashboard.overview',
};

// 全量聚合刷新的最小间隔：统计投影由读端 60s/20s 缓存兜底，
// 事件风暴（批量上传、导入）中每次事件都触发全表聚合纯属浪费。
// 投影在窗口内的短暂陈旧由缓存 TTL 对齐兜底。
const MIN_REFRESH_INTERVAL_MS = 5_000;

export class SystemStatsProjectionRefreshService {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.statsRepo = deps.statsRepo || new StatsRepository(db);
    this.orderStatsRepo = deps.orderStatsRepo || new OrderStatsRepository(db);
    this.folderRepo = deps.folderRepo || new FolderRepository(db);
    this.projectionRepo =
      deps.projectionRepo || new SystemStatsProjectionRepository(db, { now: this.now });
  }

  async refresh(scope) {
    // 节流：投影在最小间隔内已刷新则跳过本轮全量聚合
    if (this.projectionRepo && typeof this.projectionRepo.get === 'function') {
      const existing = await this.projectionRepo.get(scope);
      if (existing?.updatedAt && this.now() - existing.updatedAt < MIN_REFRESH_INTERVAL_MS) {
        return { skipped: true, scope, updatedAt: existing.updatedAt };
      }
    }

    if (scope === STATS_PROJECTION_SCOPES.MANAGE_STATS) {
      return this.refreshManageStats();
    }
    if (scope === STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW) {
      return this.refreshDashboardOverview();
    }
    throw new Error(`unknown system stats projection scope: ${scope}`);
  }

  async refreshManageStats() {
    const generatedAt = new Date(this.now()).toISOString();
    const todayStart = getChinaDayStart();
    const ninetyDaysAgo = todayStart - 89 * MS_PER_DAY;

    const [
      data,
      salesTrend,
      statusDistribution,
      topProducts,
      salespersonStats,
      profitSummary,
      profitTrend,
      profitByProduct,
    ] = await Promise.all([
      this.statsRepo.getGlobalStats(todayStart),
      this.orderStatsRepo.getSalesTrend(ninetyDaysAgo),
      this.orderStatsRepo.getStatusDistribution(),
      this.orderStatsRepo.getTopProducts(10),
      this.orderStatsRepo.getSalespersonStats(),
      this.orderStatsRepo.getProfitSummary(),
      this.orderStatsRepo.getProfitTrend(ninetyDaysAgo),
      this.orderStatsRepo.getProfitByProduct(10),
    ]);

    return this.projectionRepo.upsert(
      STATS_PROJECTION_SCOPES.MANAGE_STATS,
      {
        data: {
          business: {
            totalOrders: data.business?.totalOrders || 0,
            pendingOrders: data.business?.pendingOrders || 0,
            fulfilledOrders: data.business?.fulfilledOrders || 0,
            activeSalespersons: data.business?.activeSalespersons || 0,
            multilineOrders: data.business?.multilineOrders || 0,
          },
          profit: {
            totalRevenue: profitSummary.totalRevenue,
            totalCost: profitSummary.totalCost,
            totalProfit: profitSummary.totalProfit,
            margin: profitSummary.margin,
            ordersWithCost: profitSummary.ordersWithCost,
            ordersWithoutCost: profitSummary.ordersWithoutCost,
          },
          storage: {
            totalFiles: data.files.total,
            totalSize: data.files.totalSize,
            todayUploads: data.files.todayUploads,
            used: data.files.totalSize,
            limit: null,
          },
          traffic: data.traffic,
          health: {
            status: data.status,
            fileTypes: data.fileTypes,
          },
          charts: {
            salesTrend,
            statusDistribution,
            topProducts,
            salespersonStats,
            profitTrend,
            profitByProduct,
          },
          generatedAt,
        },
      },
      this.now()
    );
  }

  async refreshDashboardOverview() {
    const generatedAt = new Date(this.now()).toISOString();
    const todayStartTimestamp = getChinaDayStart();
    const weekStartTimestamp = todayStartTimestamp - 6 * MS_PER_DAY;
    const lastWeekStartTimestamp = weekStartTimestamp - 7 * MS_PER_DAY;
    const thirtyDaysAgo = todayStartTimestamp - 29 * MS_PER_DAY;
    const now = this.now();

    const [
      todayCount,
      pendingCount,
      recentPendingOrders,
      weekCount,
      lastWeekCount,
      activeSharesCount,
      todayHourlyTrend,
      pendingTrend,
      weekTrendData,
      shareTrend,
      recentFiles,
      recentShares,
      salesTrend,
      statusDistribution,
      profitSummary,
    ] = await Promise.all([
      this.orderStatsRepo.countCreatedAfter(todayStartTimestamp),
      this.orderStatsRepo.countByStatus('pending'),
      this.orderStatsRepo.getRecentPending(8),
      this.orderStatsRepo.countCreatedAfter(weekStartTimestamp),
      this.orderStatsRepo.countCreatedBetween(lastWeekStartTimestamp, weekStartTimestamp),
      this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM folders
        WHERE is_public = 1 AND (share_expires_at IS NULL OR share_expires_at > ?)
      `
        )
        .bind(now)
        .first()
        .then((row) => row?.count || 0),
      this.orderStatsRepo.getTodayHourlyTrend(todayStartTimestamp),
      this.orderStatsRepo.getLast7DaysPendingTrend(weekStartTimestamp),
      this.orderStatsRepo.getLast7DaysOrderTrend(weekStartTimestamp),
      this.orderStatsRepo.getLast7DaysShareTrend(weekStartTimestamp),
      this.statsRepo.getRecentFiles(5).then((files) =>
        files.map((file) => ({
          ...file,
          url: getFileUrl(file.storage_key),
        }))
      ),
      this.folderRepo.findShared({ limit: 5 }).then((result) => result.items),
      this.orderStatsRepo.getSalesTrend(thirtyDaysAgo),
      this.orderStatsRepo.getStatusDistribution(),
      this.orderStatsRepo.getProfitSummary(),
    ]);

    return this.projectionRepo.upsert(
      STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW,
      {
        data: {
          todayCount,
          pendingCount,
          recentPendingOrders,
          weekCount,
          lastWeekCount,
          activeSharesCount,
          profit: {
            totalRevenue: profitSummary.totalRevenue,
            totalCost: profitSummary.totalCost,
            totalProfit: profitSummary.totalProfit,
            margin: profitSummary.margin,
          },
          charts: {
            today: todayHourlyTrend,
            pending: pendingTrend,
            week: weekTrendData,
            shares: shareTrend,
            salesTrend,
            statusDistribution,
          },
          recentFiles,
          recentShares,
          generatedAt,
        },
      },
      this.now()
    );
  }
}
