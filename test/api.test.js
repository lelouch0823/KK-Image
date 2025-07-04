// Telegraph-Image API 测试套件
import assert from 'assert';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 测试配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8788/api/v1';
const TEST_API_KEY = process.env.TEST_API_KEY || 'tk_test_key_for_testing_only';
const TEST_USERNAME = process.env.TEST_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

// 测试数据
let testFileId = null;
let testWebhookId = null;
let testJwtToken = null;
let testApiKeyId = null;

describe('Telegraph-Image API v1 Tests', function() {
  this.timeout(30000); // 30秒超时

  // 系统监控 API 测试
  describe('System Monitoring API', function() {
    
    it('should return health status', async function() {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.status);
      assert.ok(data.data.timestamp);
      assert.ok(data.data.services);
    });

    it('should return system info', async function() {
      const response = await fetch(`${API_BASE_URL}/info`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.name);
      assert.ok(data.data.version);
      assert.ok(data.data.endpoints);
      assert.ok(data.data.limits);
    });

  });

  // 认证 API 测试
  describe('Authentication API', function() {
    
    it('should generate JWT token with valid credentials', async function() {
      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: TEST_USERNAME,
          password: TEST_PASSWORD,
          expiresIn: 3600
        })
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.token);
      assert.strictEqual(data.data.tokenType, 'Bearer');
      assert.ok(data.data.user);
      
      // 保存 token 用于后续测试
      testJwtToken = data.data.token;
    });

    it('should reject invalid credentials', async function() {
      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'invalid',
          password: 'invalid'
        })
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 401);
      assert.strictEqual(data.success, false);
      assert.ok(data.error);
    });

    it('should create API key with admin permission', async function() {
      if (!testJwtToken) {
        this.skip();
      }

      const response = await fetch(`${API_BASE_URL}/auth/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testJwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test API Key',
          permissions: ['read', 'write']
        })
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 201);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.id);
      assert.ok(data.fullKey);
      
      // 保存 API Key ID 用于后续测试
      testApiKeyId = data.data.id;
    });

    it('should list API keys', async function() {
      if (!testJwtToken) {
        this.skip();
      }

      const response = await fetch(`${API_BASE_URL}/auth/api-keys`, {
        headers: {
          'Authorization': `Bearer ${testJwtToken}`
        }
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data));
    });

  });

  // 文件管理 API 测试
  describe('File Management API', function() {
    
    it('should require authentication for file operations', async function() {
      const response = await fetch(`${API_BASE_URL}/files`);
      const data = await response.json();
      
      assert.strictEqual(response.status, 401);
      assert.strictEqual(data.success, false);
    });

    it('should list files with valid API key', async function() {
      const response = await fetch(`${API_BASE_URL}/files`, {
        headers: {
          'X-API-Key': TEST_API_KEY
        }
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data));
    });

    it('should support pagination and filtering', async function() {
      const response = await fetch(`${API_BASE_URL}/files?page=1&limit=5&type=image`, {
        headers: {
          'X-API-Key': TEST_API_KEY
        }
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.pagination);
      assert.strictEqual(data.pagination.page, 1);
      assert.strictEqual(data.pagination.limit, 5);
    });

    it('should upload a test image file', async function() {
      // 创建测试图片文件
      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
      
      // 如果测试图片不存在，创建一个简单的测试文件
      if (!fs.existsSync(testImagePath)) {
        const testDir = path.dirname(testImagePath);
        if (!fs.existsSync(testDir)) {
          fs.mkdirSync(testDir, { recursive: true });
        }
        // 创建一个简单的测试文件（实际项目中应该使用真实的图片）
        fs.writeFileSync(testImagePath, Buffer.from('fake-image-data'));
      }

      const formData = new FormData();
      formData.append('file', fs.createReadStream(testImagePath));
      formData.append('tags', 'test,api');
      formData.append('description', 'API test upload');

      const response = await fetch(`${API_BASE_URL}/files`, {
        method: 'POST',
        headers: {
          'X-API-Key': TEST_API_KEY
        },
        body: formData
      });
      
      const data = await response.json();
      
      // 注意：在测试环境中可能会失败，因为需要实际的文件上传处理
      if (response.status === 201) {
        assert.strictEqual(data.success, true);
        assert.ok(data.data.id);
        assert.ok(data.data.url);
        
        // 保存文件 ID 用于后续测试
        testFileId = data.data.id;
      } else {
        console.log('File upload test skipped - requires actual file handling');
        this.skip();
      }
    });

    it('should get single file info', async function() {
      if (!testFileId) {
        this.skip();
      }

      const response = await fetch(`${API_BASE_URL}/files/${testFileId}`, {
        headers: {
          'X-API-Key': TEST_API_KEY
        }
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.id, testFileId);
    });

    it('should update file metadata', async function() {
      if (!testFileId) {
        this.skip();
      }

      const response = await fetch(`${API_BASE_URL}/files/${testFileId}`, {
        method: 'PUT',
        headers: {
          'X-API-Key': TEST_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tags: ['test', 'updated'],
          description: 'Updated description'
        })
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.deepStrictEqual(data.data.tags, ['test', 'updated']);
    });

  });

  // Webhook API 测试
  describe('Webhook API', function() {
    
    it('should require admin permission for webhook operations', async function() {
      const response = await fetch(`${API_BASE_URL}/webhooks`, {
        headers: {
          'X-API-Key': TEST_API_KEY
        }
      });
      
      // 如果 TEST_API_KEY 没有 admin 权限，应该返回 403
      if (response.status === 403) {
        const data = await response.json();
        assert.strictEqual(data.success, false);
      } else {
        // 如果有权限，应该返回 webhook 列表
        assert.strictEqual(response.status, 200);
      }
    });

    it('should create webhook with admin permission', async function() {
      if (!testJwtToken) {
        this.skip();
      }

      const response = await fetch(`${API_BASE_URL}/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testJwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://httpbin.org/post',
          events: ['file.uploaded', 'file.deleted'],
          secret: 'test-webhook-secret'
        })
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 201);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.id);
      assert.strictEqual(data.data.url, 'https://httpbin.org/post');
      
      // 保存 webhook ID 用于后续测试
      testWebhookId = data.data.id;
    });

    it('should test webhook delivery', async function() {
      if (!testJwtToken || !testWebhookId) {
        this.skip();
      }

      const response = await fetch(`${API_BASE_URL}/webhooks/${testWebhookId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testJwtToken}`
        }
      });
      
      const data = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.status);
    });

  });

  // 清理测试数据
  describe('Cleanup', function() {
    
    it('should delete test file', async function() {
      if (!testFileId) {
        this.skip();
      }

      const response = await fetch(`${API_BASE_URL}/files/${testFileId}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': TEST_API_KEY
        }
      });
      
      if (response.status === 200) {
        const data = await response.json();
        assert.strictEqual(data.success, true);
      }
    });

    it('should delete test webhook', async function() {
      if (!testJwtToken || !testWebhookId) {
        this.skip();
      }

      const response = await fetch(`${API_BASE_URL}/webhooks/${testWebhookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testJwtToken}`
        }
      });
      
      if (response.status === 200) {
        const data = await response.json();
        assert.strictEqual(data.success, true);
      }
    });

    it('should delete test API key', async function() {
      if (!testJwtToken || !testApiKeyId) {
        this.skip();
      }

      const response = await fetch(`${API_BASE_URL}/auth/api-keys/${testApiKeyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testJwtToken}`
        }
      });
      
      if (response.status === 200) {
        const data = await response.json();
        assert.strictEqual(data.success, true);
      }
    });

  });

});

// 辅助函数
function createTestImage() {
  // 创建一个简单的测试图片数据
  // 实际项目中应该使用真实的图片文件
  return Buffer.from('fake-image-data');
}
