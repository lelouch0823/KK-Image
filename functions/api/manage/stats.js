import { success, error } from '../utils/response.js';

export async function onRequest(context) {
  const {
    request,
    env,
    params,
    waitUntil,
    next,
    data,
  } = context;

  try {
    // 获取所有文件数据
    const allFiles = await env.img_url.list();
    const files = allFiles.keys;

    // 基础统计
    const totalFiles = files.length;
    const currentTime = Date.now();
    const oneDayAgo = currentTime - (24 * 60 * 60 * 1000);
    const oneWeekAgo = currentTime - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = currentTime - (30 * 24 * 60 * 60 * 1000);

    // 初始化统计计数器
    let todayUploads = 0;
    let weekUploads = 0;
    let monthUploads = 0;
    let totalSize = 0;
    const statusStats = { normal: 0, blocked: 0, whitelisted: 0, liked: 0 };
    const fileTypeStats = {};

    // 单次遍历完成所有统计（性能优化）
    const fileStats = files.map(file => {
      // metadata 已经是对象，不需要 JSON.parse
      const metadata = file.metadata || {};

      const timestamp = metadata.TimeStamp || 0;
      const listType = metadata.ListType || 'None';
      const fileSize = metadata.fileSize || 0;
      const liked = metadata.liked || false;
      const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';

      // 时间范围统计（单次遍历中完成）
      if (timestamp > oneDayAgo) todayUploads++;
      if (timestamp > oneWeekAgo) weekUploads++;
      if (timestamp > oneMonthAgo) monthUploads++;

      // 累计文件大小
      totalSize += fileSize;

      // 状态统计
      if (listType === 'None') statusStats.normal++;
      else if (listType === 'Block') statusStats.blocked++;
      else if (listType === 'White') statusStats.whitelisted++;
      if (liked) statusStats.liked++;

      // 文件类型统计
      fileTypeStats[extension] = (fileTypeStats[extension] || 0) + 1;

      return {
        name: file.name,
        timestamp,
        listType,
        label: metadata.Label || metadata.rating_label || 'None',
        liked,
        fileName: metadata.fileName || file.name,
        fileSize,
        expiration: file.expiration
      };
    });

    // 计算平均大小
    const averageSize = totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0;

    // 每日上传趋势（最近30天）
    const dailyStats = {};
    for (let i = 29; i >= 0; i--) {
      const date = new Date(currentTime - (i * 24 * 60 * 60 * 1000));
      const dateKey = date.toISOString().split('T')[0];
      const dayStart = date.setHours(0, 0, 0, 0);
      const dayEnd = date.setHours(23, 59, 59, 999);

      dailyStats[dateKey] = fileStats.filter(f =>
        f.timestamp >= dayStart && f.timestamp <= dayEnd
      ).length;
    }

    // 每小时上传分布（今天）
    const hourlyStats = {};
    for (let hour = 0; hour < 24; hour++) {
      const hourStart = new Date();
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date();
      hourEnd.setHours(hour, 59, 59, 999);

      hourlyStats[hour] = fileStats.filter(f => {
        const fileDate = new Date(f.timestamp);
        return fileDate >= hourStart && fileDate <= hourEnd &&
          fileDate.toDateString() === new Date().toDateString();
      }).length;
    }

    // 文件大小分布
    const sizeRanges = {
      'small': { min: 0, max: 100 * 1024, count: 0 }, // < 100KB
      'medium': { min: 100 * 1024, max: 1024 * 1024, count: 0 }, // 100KB - 1MB
      'large': { min: 1024 * 1024, max: 10 * 1024 * 1024, count: 0 }, // 1MB - 10MB
      'xlarge': { min: 10 * 1024 * 1024, max: Infinity, count: 0 } // > 10MB
    };

    fileStats.forEach(file => {
      const size = file.fileSize || 0;
      Object.keys(sizeRanges).forEach(range => {
        const { min, max } = sizeRanges[range];
        if (size >= min && size < max) {
          sizeRanges[range].count++;
        }
      });
    });

    // 最近活动
    const recentFiles = fileStats
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map(file => ({
        name: file.fileName,
        timestamp: file.timestamp,
        size: file.fileSize,
        type: file.name.split('.').pop()?.toLowerCase()
      }));

    // 热门文件类型（按数量排序）
    const topFileTypes = Object.entries(fileTypeStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    const stats = {
      overview: {
        totalFiles,
        todayUploads,
        weekUploads,
        monthUploads,
        totalSize,
        averageSize
      },
      status: statusStats,
      fileTypes: {
        distribution: fileTypeStats,
        top: topFileTypes
      },
      trends: {
        daily: dailyStats,
        hourly: hourlyStats
      },
      storage: {
        totalSize,
        averageSize,
        sizeDistribution: sizeRanges
      },
      recent: recentFiles,
      performance: {
        responseTime: Date.now() - currentTime,
        cacheStatus: 'miss',
        lastUpdated: currentTime
      }
    };

    return success(stats, 'Success', 200, {
      'Cache-Control': 'public, max-age=300' // 缓存5分钟
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return error(error.message, 500);
  }
}
