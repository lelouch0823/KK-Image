export default {
  erpSync: {
    title: 'ERP Data Sync',
    connections: 'Connections',
    connection: 'Connection',
    addConnection: 'Add Connection',
    editConnection: 'Edit Connection',
    deleteConnection: 'Delete Connection',
    deleteConfirm: 'Are you sure to delete this ERP connection? Sync mapping data will be lost.',
    name: 'Connection Name',
    adapterType: 'Adapter Type',
    baseUrl: 'API URL',
    authType: 'Authentication',
    credentials: 'Credentials',
    config: 'Advanced Config',
    syncDirection: 'Sync Direction',
    enabled: 'Enabled',
    status: 'Status',
    lastSyncAt: 'Last Sync',
    lastSyncStatus: 'Sync Result',
    lastError: 'Last Error',

    adapter: {
      generic: 'Generic REST',
      rest: 'REST API',
      kingdee: 'Kingdee',
      yonyou: 'Yonyou',
      sap: 'SAP',
    },

    auth: {
      api_key: 'API Key',
      oauth2: 'OAuth2.0',
      basic: 'Basic Auth',
    },

    direction: {
      push: 'Push Only',
      pull: 'Pull Only',
      bidirectional: 'Bidirectional',
    },

    syncStatus: {
      success: 'Success',
      partial: 'Partial',
      failed: 'Failed',
      never: 'Never',
    },

    actions: {
      test: 'Test Connection',
      testSuccess: 'Connection test passed',
      testFailed: 'Connection test failed',
      sync: 'Sync Now',
      syncStarted: 'Sync started',
      syncSuccess: 'Sync completed',
      syncFailed: 'Sync failed',
    },

    logs: {
      title: 'Sync Logs',
      connection: 'Connection',
      entityType: 'Entity Type',
      direction: 'Direction',
      action: 'Action',
      status: 'Status',
      entityId: 'Local ID',
      erpId: 'ERP ID',
      error: 'Error',
      createdAt: 'Time',
      noData: 'No sync logs',
    },

    entity: {
      product: 'Product',
      customer: 'Customer',
      order: 'Order',
    },

    action: {
      create: 'Create',
      update: 'Update',
      delete: 'Delete',
    },

    logStatus: {
      pending: 'Pending',
      success: 'Success',
      failed: 'Failed',
      conflict: 'Conflict',
    },

    stats: {
      title: 'Sync Statistics',
      total: 'Total',
      success: 'Success',
      failed: 'Failed',
      pending: 'Pending',
      conflict: 'Conflict',
    },

    mappings: {
      title: 'Entity Mappings',
      localId: 'Local ID',
      erpId: 'ERP ID',
      erpCode: 'ERP Code',
      lastSyncedAt: 'Last Synced',
      noData: 'No mapping data',
    },

    webhook: {
      title: 'Webhook Configuration',
      url: 'Callback URL',
      description: 'Configure this URL in your ERP system for automatic sync on data changes',
    },

    form: {
      namePlaceholder: 'Enter connection name',
      baseUrlPlaceholder: 'https://erp.example.com/api',
      apiKeyPlaceholder: 'Enter API Key',
      usernamePlaceholder: 'Username',
      passwordPlaceholder: 'Password',
      save: 'Save',
      cancel: 'Cancel',
    },

    empty: 'No ERP connections',
    loading: 'Loading...',
  },
};
