export default {
  erpSync: {
    title: 'ERP 数据同步',
    connections: '连接管理',
    connection: '连接',
    addConnection: '添加连接',
    editConnection: '编辑连接',
    deleteConnection: '删除连接',
    deleteConfirm: '确定删除此 ERP 连接？删除后同步映射数据将丢失。',
    name: '连接名称',
    adapterType: '适配器类型',
    baseUrl: 'API 地址',
    authType: '认证方式',
    credentials: '凭据配置',
    config: '高级配置',
    syncDirection: '同步方向',
    enabled: '启用状态',
    status: '状态',
    lastSyncAt: '最近同步',
    lastSyncStatus: '同步结果',
    lastError: '最近错误',

    adapter: {
      generic: '通用 REST',
      rest: 'REST API',
      kingdee: '金蝶',
      yonyou: '用友',
      sap: 'SAP',
    },

    auth: {
      api_key: 'API Key',
      oauth2: 'OAuth2.0',
      basic: 'Basic Auth',
    },

    direction: {
      push: '仅推送',
      pull: '仅拉取',
      bidirectional: '双向同步',
    },

    syncStatus: {
      success: '成功',
      partial: '部分成功',
      failed: '失败',
      never: '未同步',
    },

    actions: {
      test: '测试连接',
      testSuccess: '连接测试成功',
      testFailed: '连接测试失败',
      sync: '立即同步',
      syncStarted: '同步已启动',
      syncSuccess: '同步完成',
      syncFailed: '同步失败',
    },

    logs: {
      title: '同步日志',
      connection: '连接',
      entityType: '实体类型',
      direction: '方向',
      action: '操作',
      status: '状态',
      entityId: '本地 ID',
      erpId: 'ERP ID',
      error: '错误信息',
      createdAt: '时间',
      noData: '暂无同步日志',
    },

    entity: {
      product: '商品',
      customer: '客户',
      order: '订单',
    },

    action: {
      create: '创建',
      update: '更新',
      delete: '删除',
    },

    logStatus: {
      pending: '待处理',
      success: '成功',
      failed: '失败',
      conflict: '冲突',
    },

    stats: {
      title: '同步统计',
      total: '总记录',
      success: '成功',
      failed: '失败',
      pending: '待处理',
      conflict: '冲突',
    },

    mappings: {
      title: '实体映射',
      localId: '本地 ID',
      erpId: 'ERP ID',
      erpCode: 'ERP 编码',
      lastSyncedAt: '最近同步',
      noData: '暂无映射数据',
    },

    webhook: {
      title: 'Webhook 配置',
      url: '回调地址',
      description: '将以下地址配置到 ERP 系统，数据变更时自动同步',
    },

    form: {
      namePlaceholder: '输入连接名称',
      baseUrlPlaceholder: 'https://erp.example.com/api',
      apiKeyPlaceholder: '输入 API Key',
      usernamePlaceholder: '用户名',
      passwordPlaceholder: '密码',
      save: '保存',
      cancel: '取消',
    },

    empty: '暂无 ERP 连接',
    loading: '加载中...',
  },
};
