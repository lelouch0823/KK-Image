// API 信息端点
export async function onRequestGet(context) {
  const { env } = context;
  
  const apiInfo = {
    name: 'Telegraph-Image API',
    version: '1.0.0',
    description: 'RESTful API for Telegraph-Image file management system',
    documentation: 'https://github.com/x-dr/telegraph-Image',
    endpoints: {
      files: {
        'GET /api/v1/files': 'List files with pagination and filtering',
        'POST /api/v1/files': 'Upload a new file',
        'GET /api/v1/files/{id}': 'Get file information',
        'PUT /api/v1/files/{id}': 'Update file metadata',
        'DELETE /api/v1/files/{id}': 'Delete a file'
      },
      webhooks: {
        'GET /api/v1/webhooks': 'List registered webhooks',
        'POST /api/v1/webhooks': 'Register a new webhook',
        'DELETE /api/v1/webhooks/{id}': 'Delete a webhook',
        'POST /api/v1/webhooks/{id}/test': 'Test a webhook'
      },
      auth: {
        'POST /api/v1/auth/token': 'Generate JWT token',
        'POST /api/v1/auth/api-keys': 'Create API key',
        'GET /api/v1/auth/api-keys': 'List API keys',
        'DELETE /api/v1/auth/api-keys/{id}': 'Delete API key'
      },
      system: {
        'GET /api/v1/health': 'Health check',
        'GET /api/v1/info': 'API information'
      }
    },
    authentication: {
      methods: ['API Key', 'JWT Token'],
      headers: {
        'X-API-Key': 'API Key authentication',
        'Authorization': 'Bearer JWT token'
      }
    },
    rateLimit: {
      window: '1 minute',
      maxRequests: 100
    },
    supportedFileTypes: [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp'
    ],
    maxFileSize: '10MB',
    webhookEvents: [
      'file.uploaded',
      'file.updated', 
      'file.deleted',
      'user.created',
      'api_key.created',
      'api_key.deleted'
    ],
    timestamp: new Date().toISOString()
  };
  
  // 添加运行时信息
  if (env.CF_PAGES_COMMIT_SHA) {
    apiInfo.build = {
      commit: env.CF_PAGES_COMMIT_SHA,
      branch: env.CF_PAGES_BRANCH || 'unknown'
    };
  }
  
  return new Response(JSON.stringify(apiInfo, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
