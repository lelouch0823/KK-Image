export default {
  oauth: {
    title: 'OAuth2.0 授权',
    apps: '应用管理',
    app: '应用',
    addApp: '注册应用',
    editApp: '编辑应用',
    deleteApp: '删除应用',
    deleteConfirm: '确定删除此 OAuth 应用？所有关联的令牌将被撤销。',
    name: '应用名称',
    description: '应用描述',
    clientId: 'Client ID',
    clientSecret: 'Client Secret',
    redirectUris: '回调地址',
    grantTypes: '授权类型',
    scopes: '权限范围',
    enabled: '启用状态',
    createdAt: '创建时间',

    grantType: {
      authorization_code: '授权码模式',
      refresh_token: '刷新令牌',
    },

    scope: {
      read: '读取',
      write: '写入',
      admin: '管理',
    },

    actions: {
      regenerateSecret: '重新生成密钥',
      regenerateSecretConfirm: '确定重新生成密钥？旧密钥将立即失效。',
      secretRegenerated: '密钥已重新生成，请妥善保存',
      revokeTokens: '撤销所有令牌',
      revokeTokensConfirm: '确定撤销该应用的所有活跃令牌？',
      tokensRevoked: '所有令牌已撤销',
      viewTokens: '查看令牌',
    },

    tokens: {
      title: '活跃令牌',
      accessToken: '访问令牌',
      refreshToken: '刷新令牌',
      scopes: '权限范围',
      expiresAt: '过期时间',
      createdAt: '创建时间',
      noData: '暂无活跃令牌',
    },

    authorize: {
      title: '授权请求',
      description: '应用 {name} 请求以下权限：',
      allow: '允许授权',
      deny: '拒绝',
      success: '授权成功',
      denied: '授权已拒绝',
    },

    form: {
      namePlaceholder: '输入应用名称',
      descriptionPlaceholder: '输入应用描述（可选）',
      redirectUriPlaceholder: '输入回调地址，按回车添加',
      save: '保存',
      cancel: '取消',
    },

    empty: '暂无 OAuth 应用',
    loading: '加载中...',
    copySuccess: '已复制到剪贴板',
    secretWarning: '请立即保存密钥，关闭后将无法再次查看',
  },
};
