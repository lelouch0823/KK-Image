// 杂项翻译 (share, fileSelector, moveFile, header, sidebar, etc.)
export default {
  // 分享
  share: {
    management: '分享链接管理',
    titleFile: '分享文件',
    titleFolder: '分享文件夹',
    existingLink: '已有分享链接',
    expiration: '有效期',
    days7: '7天',
    days30: '30天',
    permanent: '永久',
    regenerate: '重新生成',
    generate: '创建分享链接',
    update: '更新分享链接',
    directLink: '文件直链 (永久有效)',
    copiedClipboard: '已复制到剪贴板',
    copyLink: '复制链接',
    networkError: '网络错误',
    needUpdateExpiry: '是否需要更新有效时间？',
    generateFailed: '生成失败',
    linkCopied: '链接已复制',
    unknownFile: '未知文件',
    folderName: '文件夹名称',
    linkToken: '链接 / Token',
    expiry: '有效期',
    actions: '操作',
    total: '共 {count} 条',
    prevPage: '上一页',
    nextPage: '下一页',
    noActiveShares: '暂无活跃分享',
    table: {
      name: '文件名称',
      code: '提取码',
      expires: '过期时间',
    },
  },

  // 文件选择器
  fileSelector: {
    title: '选择文件',
    selectedCount: '已选择 {count} 个文件',
    allFiles: '全部文件',
    empty: '此文件夹为空',
    cancel: '取消',
    add: '添加',
  },

  // 移动文件
  moveFile: {
    title: '移动到...',
    root: '根目录',
    empty: '暂无其他文件夹',
    cancel: '取消',
    move: '移动',
    moving: '移动中...',
    moveSuccess: '文件移动成功',
    moveFailed: '移动失败',
    loadFailed: '加载文件夹列表失败',
    opFailed: '操作失败',
  },

  // 页头
  header: {
    searchPlaceholder: '搜索文件...',
    refresh: '刷新',
  },

  // 侧边栏
  sidebar: {
    menu: '菜单',
    manage: '管理',
    dashboard: '概览',
    files: '文件管理',
    spaces: '共享空间',
    stats: '统计',
    logout: '退出登录',
    admin: '管理员',
    role: '管理员',
    collapse: '收起侧边栏',
    expand: '展开侧边栏',
    trash: '回收站',
  },

  // 视图
  views: {
    dashboard: '概览',
    files: '文件管理',
    stats: '统计',
    customers: '客户管理',
    products: '商品管理',
    admin: '管理后台',
    trash: '回收站',
  },

  // 文件操作 (Composables)
  fileOps: {
    loadFailed: '加载失败',
    folderCreateSuccess: '文件夹创建成功',
    createFailed: '创建失败',
    updateSuccess: '更新成功',
    updateFailed: '更新失败',
    deleteSuccess: '删除成功',
    deleteFailed: '删除失败',
    fileDeleted: '文件已删除',
    renameSuccess: '重命名成功',
    renameFailed: '重命名失败',
    moveFailed: '移动失败',
  },

  // 上传队列
  uploadQueue: {
    selectFolderFirst: '请先选择上传目录',
    fileTooLarge: '{count} 个文件超过限制 (100MB)',
    uploadFailed: '上传失败',
    parseError: '响应解析失败',
    networkError: '网络错误',
    instantUpload: '秒传成功',
  },

  // 批量下载
  batchDownload: {
    started: '下载已开始',
    failed: '打包下载失败',
  },

  // 通知
  notification: {
    title: '通知中心',
    markAllRead: '全部已读',
    empty: '暂无通知',
    newFeedback: '您有新的订单反馈',
    permissionDenied: '请允许浏览器通知以接收新消息提醒',
    newOrder: '收到新订单',
    reminder: {
      pending_order_title: '待处理订单提醒',
      pending_order_desc: '订单 {orderNo} 已超过 24 小时未处理，请及时审核。',
      deadline_title: '交货期临近提醒',
      deadline_desc: '订单 {orderNo} 期望交货日期为 {deadline}，请关注进度。',
    },
    order: {
      created: '收到新订单',
      createdDesc: '{salesperson} 提交了订单 {orderNo}',
      updated: '订单已修改',
      updatedDesc: '{actor} 修改了订单 {orderNo}',
      commented: '收到新留言',
      commentedDesc: '{actor} 在订单 {orderNo} 中留言',
      statusChanged: '订单状态更新',
      statusChangedDesc: '订单 {orderNo} 状态已变更为 {status}',
      batchStatusChanged: '批量订单状态更新',
      batchStatusChangedDesc: '{count} 个订单已{action}',
    },
  },

  // 搜索
  search: {
    history: '搜索历史',
    clearHistory: '清除历史',
    noHistory: '暂无搜索记录',
  },

  // 路由
  router: {
    login: '登录',
    gallery_share: '相册分享',
    space_share: '共享空间',
    sales_portal: '销售门户',
    order_list: '订单列表',
    new_order: '新建订单',
    order_detail: '订单详情',
    personal_stats: '个人统计',
    dashboard: '仪表盘',
    file_management: '文件管理',
    space_management: '共享空间管理',
    salesperson_management: '销售管理',
    product_management: '商品管理',
    product_detail: '商品详情',
    order_management: '预定管理',
    customer_management: '客户管理',
    stats_analysis: '统计分析',
    system_settings: '系统设置',
    trash: '回收站',
  },

  // PWA
  pwa: {
    offlineReady: '应用已准备好离线使用',
    newContent: '发现新版本',
    offlineReadyDesc: '您可以随时在没有网络的情况下访问此应用。',
    newContentDesc: '请点击刷新以获取最新功能。',
    reload: '立即刷新',
    close: '关闭',
  },

  // 销售统计
  salesStats: {
    title: '个人统计',
    totalOrders: '累计订单',
    completedOrders: '已完成订单',
    monthOrders: '本月订单',
  },

  // AI 助手
  ai: {
    assistant: 'AI 助手',
    subtitle: '全能数据统计助手',
    placeholder: '询问订单、客户、销售、空间或文件统计...',
    error: 'AI 助手暂时无法响应',
    networkError: '网络请求失败，请稀后再试',
    welcome: '您好！我是您的全能管理助手。我可以查询订单、客户、销售、共享空间和文件存储等各类统计数据。请问有什么可以帮您？',
    thinking: 'AI 正在思考...',
    toolLoading: '正在查询{tool}数据...',
    clear: '清空会话',
    clearConfirm: '确定要清空聊天记录吗？',
    copySuccess: '消息已复制到剪贴板',
    modelSwitch: '模型额度已达上限，已自动切换至备用模型',
    generateReport: '生成完整数据报告',
    generatingReport: '正在生成报告...',
    reportGenerated: '报告已生成，请查看新窗口',
    reportError: '报告生成失败，请稀后再试',
    toolNames: {
      getOrderStats: '订单统计',
      getRecentPendingOrders: '待处理订单',
      getCustomerStats: '客户统计',
      getSpaceStats: '共享空间数据',
      getSalespersonStats: '销售员表现',
      getFileStats: '文件库分析',
    },
    suggestions: {
      dailyReport: '今日数据日报',
      monthlySalesRanking: '本月销售排行榜',
      systemStatus: '系统状态',
      pendingOrders: '待处理订单',
      todayNewOrders: '今日新增订单数',
      weeklySalesTrend: '本周销售趋势',
      weeklyNewCustomers: '本周新增客户',
      customerCount: '客户总数统计',
      spaceUsage: '空间使用情况',
      recentActiveSpaces: '最近活跃空间',
      downloadTop10: '下载量Top10',
      storageUsage: '存储空间占用',
      largeFileAnalysis: '大文件分析',
      fileTypeDistribution: '文件类型分布',
      myDailyPerformance: '我的业绩日报',
      monthlyCommission: '本月提成预估',
    },
  },
};
