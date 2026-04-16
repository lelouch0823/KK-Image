import { getChinaDayStart, getFileUrl } from '../_shared/utils.js';
import { FolderRepository } from '../repositories/FolderRepository.js';
import { OrderStatsRepository } from '../repositories/OrderStatsRepository.js';
import { StatsRepository } from '../repositories/StatsRepository.js';
import { SystemStatsProjectionRepository } from '../repositories/SystemStatsProjectionRepository.js';

export const STATS_PROJECTION_SCOPES = {
  MANAGE_STATS: 'manage.stats',
  DASHBOARD_OVERVIEW: 'manage.dashboard.overview',
};

export class SystemStatsProjectionRefreshService {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.statsRepo = deps.statsRepo || new StatsRepository(db);
    this.orderStatsRepo = deps.orderStatsRepo || new OrderStatsRepository(db);
    this.folderRepo = deps.folderRepo || new FolderRepository(db);
    this.projectionRepo = deps.projectionRepo || new SystemStatsProjectionRepository(db, { now: this.now });
  }

  async refresh(scope) {
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
    const data = await this.statsRepo.getGlobalStats(todayStart);

    return this.projectionRepo.upsert(STATS_PROJECTION_SCOPES.MANAGE_STATS, {
      data: {
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
        generatedAt,
      },
    }, this.now());
  }

  async refreshDashboardOverview() {
    const generatedAt = new Date(this.now()).toISOString();
    const todayStartTimestamp = getChinaDayStart();
    const weekStartTimestamp = todayStartTimestamp - 6 * 24 * 60 * 60 * 1000;
    const lastWeekStartTimestamp = weekStartTimestamp - 7 * 24 * 60 * 60 * 1000;
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
    ] = await Promise.all([
      this.orderStatsRepo.countCreatedAfter(todayStartTimestamp),
      this.orderStatsRepo.countByStatus('pending'),
      this.orderStatsRepo.getRecentPending(8),
      this.orderStatsRepo.countCreatedAfter(weekStartTimestamp),
      this.orderStatsRepo.countCreatedBetween(lastWeekStartTimestamp, weekStartTimestamp),
      this.db.prepare(`
        SELECT COUNT(*) as count FROM folders
        WHERE is_public = 1 AND (share_expires_at IS NULL OR share_expires_at > ?)
      `).bind(now).first().then((row) => row?.count || 0),
      this.orderStatsRepo.getTodayHourlyTrend(todayStartTimestamp),
      this.orderStatsRepo.getLast7DaysPendingTrend(weekStartTimestamp),
      this.orderStatsRepo.getLast7DaysOrderTrend(weekStartTimestamp),
      this.orderStatsRepo.getLast7DaysShareTrend(weekStartTimestamp),
      this.statsRepo.getRecentFiles(5).then((files) => files.map((file) => ({
        ...file,
        url: getFileUrl(file.storage_key),
      }))),
      this.folderRepo.findShared({ limit: 5 }).then((result) => result.items),
    ]);

    return this.projectionRepo.upsert(STATS_PROJECTION_SCOPES.DASHBOARD_OVERVIEW, {
      data: {
        todayCount,
        pendingCount,
        recentPendingOrders,
        weekCount,
        lastWeekCount,
        activeSharesCount,
        charts: {
          today: todayHourlyTrend,
          pending: pendingTrend,
          week: weekTrendData,
          shares: shareTrend,
        },
        recentFiles,
        recentShares,
        generatedAt,
      },
    }, this.now());
  }
}
