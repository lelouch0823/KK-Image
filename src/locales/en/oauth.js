export default {
  oauth: {
    title: 'OAuth2.0 Authorization',
    apps: 'App Management',
    app: 'Application',
    addApp: 'Register App',
    editApp: 'Edit App',
    deleteApp: 'Delete App',
    deleteConfirm: 'Are you sure to delete this OAuth app? All associated tokens will be revoked.',
    name: 'App Name',
    description: 'Description',
    clientId: 'Client ID',
    clientSecret: 'Client Secret',
    redirectUris: 'Redirect URIs',
    grantTypes: 'Grant Types',
    scopes: 'Scopes',
    enabled: 'Enabled',
    createdAt: 'Created',

    grantType: {
      authorization_code: 'Authorization Code',
      refresh_token: 'Refresh Token',
    },

    scope: {
      read: 'Read',
      write: 'Write',
      admin: 'Admin',
    },

    actions: {
      regenerateSecret: 'Regenerate Secret',
      regenerateSecretConfirm: 'Regenerate secret? The old secret will be invalidated immediately.',
      secretRegenerated: 'Secret regenerated. Please save it now.',
      revokeTokens: 'Revoke All Tokens',
      revokeTokensConfirm: 'Revoke all active tokens for this app?',
      tokensRevoked: 'All tokens revoked',
      viewTokens: 'View Tokens',
    },

    tokens: {
      title: 'Active Tokens',
      accessToken: 'Access Token',
      refreshToken: 'Refresh Token',
      scopes: 'Scopes',
      expiresAt: 'Expires At',
      createdAt: 'Created',
      noData: 'No active tokens',
    },

    authorize: {
      title: 'Authorization Request',
      description: 'App {name} requests the following permissions:',
      allow: 'Allow',
      deny: 'Deny',
      success: 'Authorization granted',
      denied: 'Authorization denied',
    },

    form: {
      namePlaceholder: 'Enter app name',
      descriptionPlaceholder: 'Enter description (optional)',
      redirectUriPlaceholder: 'Enter redirect URI, press Enter to add',
      save: 'Save',
      cancel: 'Cancel',
    },

    empty: 'No OAuth apps',
    loading: 'Loading...',
    copySuccess: 'Copied to clipboard',
    secretWarning: 'Please save the secret now. It will not be shown again.',
  },
};
