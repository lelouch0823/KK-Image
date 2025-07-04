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

    // 解析文件元数据
    const fileStats = files.map(file => {
      let metadata = {};
      try {
        metadata = JSON.parse(file.metadata || '{}');
      } catch (e) {
        metadata = {};
      }
      
      return {
        name: file.name,
        timestamp: metadata.TimeStamp || 0,
        listType: metadata.ListType || 'None',
        label: metadata.Label || metadata.rating_label || 'None',
        liked: metadata.liked || false,
        fileName: metadata.fileName || file.name,
        fileSize: metadata.fileSize || 0,
        expiration: file.expiration
      };
    });

    // 时间范围统计
    const todayUploads = fileStats.filter(f => f.timestamp > oneDayAgo).length;
    const weekUploads = fileStats.filter(f => f.timestamp > oneWeekAgo).length;
    const monthUploads = fileStats.filter(f => f.timestamp > oneMonthAgo).length;

    // 文件类型统计
    const fileTypeStats = {};
    fileStats.forEach(file => {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      fileTypeStats[extension] = (fileTypeStats[extension] || 0) + 1;
    });

    // 存储大小统计
    const totalSize = fileStats.reduce((sum, file) => sum + (file.fileSize || 0), 0);
    const averageSize = totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0;

    // 状态统计
    const statusStats = {
      normal: fileStats.filter(f => f.listType === 'None').length,
      blocked: fileStats.filter(f => f.listType === 'Block').length,
      whitelisted: fileStats.filter(f => f.listType === 'White').length,
      liked: fileStats.filter(f => f.liked).length
    };

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
      .sort(([,a], [,b]) => b - a)
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

    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 缓存5分钟
      }
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate statistics',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
