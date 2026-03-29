// Webhook 功能测试脚本
import fetch from 'node-fetch';
import assert from 'assert';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080';
const API_BASE = `${BASE_URL}/api/v1`;
const WEBHOOK_PORT = Number(process.env.WEBHOOK_TEST_PORT || 3001);

// 测试用的 Webhook 接收服务器
import http from 'http';

let webhookServer;
let receivedWebhooks = [];

// 启动测试 Webhook 接收服务器
function startWebhookServer(port = 3001) {
  return new Promise((resolve) => {
    webhookServer = http.createServer((req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const webhook = {
              headers: req.headers,
              body: JSON.parse(body),
              timestamp: new Date().toISOString()
            };
            receivedWebhooks.push(webhook);
            console.log('📨 Received webhook:', webhook.body.event);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Webhook received' }));
          } catch (error) {
            console.error('Error processing webhook:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    
    webhookServer.listen(port, () => {
      console.log(`🎯 Webhook test server running on port ${port}`);
      resolve(`http://localhost:${port}/webhook`);
    });
  });
}

// 停止 Webhook 接收服务器
function stopWebhookServer() {
  if (webhookServer) {
    webhookServer.close();
    console.log('🛑 Webhook test server stopped');
  }
}

// 获取 JWT Token
async function getAuthToken() {
  const response = await fetch(`${API_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: '123'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data.token;
}

// 创建 Webhook
async function createWebhook(token, webhookUrl) {
  const response = await fetch(`${API_BASE}/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      url: webhookUrl,
      events: ['file.uploaded', 'file.deleted'],
      secret: 'test-secret-key',
      enabled: true
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Create webhook failed: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data.data;
}

// 测试 Webhook
async function testWebhook(token, webhookId) {
  const response = await fetch(`${API_BASE}/webhooks/${webhookId}/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      testMessage: 'This is a test from webhook-test.js'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Test webhook failed: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data.data;
}

// 获取 Webhook 列表
async function getWebhooks(token) {
  const response = await fetch(`${API_BASE}/webhooks`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Get webhooks failed: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data.data;
}

// 删除 Webhook
async function deleteWebhook(token, webhookId) {
  const response = await fetch(`${API_BASE}/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Delete webhook failed: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data;
}

// 主测试函数
async function runWebhookTests() {
  console.log('🚀 Starting Webhook functionality tests...\n');
  let createdWebhookId = null;

  try {
    // 1. 启动测试服务器
    console.log('1️⃣ Starting webhook test server...');
    const webhookUrl = await startWebhookServer(WEBHOOK_PORT);
    console.log(`✅ Webhook server ready at: ${webhookUrl}\n`);
    
    // 2. 获取认证 Token
    console.log('2️⃣ Getting authentication token...');
    const token = await getAuthToken();
    console.log('✅ Authentication successful\n');
    
    // 3. 创建 Webhook
    console.log('3️⃣ Creating webhook...');
    const webhook = await createWebhook(token, webhookUrl);
    createdWebhookId = webhook.id;
    console.log(`✅ Webhook created: ${webhook.id}\n`);
    
    // 4. 获取 Webhook 列表
    console.log('4️⃣ Getting webhook list...');
    const webhooks = await getWebhooks(token);
    console.log(`✅ Found ${webhooks.length} webhook(s)\n`);
    
    // 5. 测试 Webhook
    console.log('5️⃣ Testing webhook delivery...');
    const testResult = await testWebhook(token, webhook.id);
    assert.strictEqual(testResult.ok, true, `Webhook test endpoint returned non-ok result: ${JSON.stringify(testResult)}`);
    console.log(`✅ Webhook test result: SUCCESS (${testResult.status} ${testResult.statusText})\n`);
    
    // 6. 等待接收 Webhook
    console.log('6️⃣ Waiting for webhook delivery...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (receivedWebhooks.length > 0) {
      console.log(`✅ Received ${receivedWebhooks.length} webhook(s):`);
      receivedWebhooks.forEach((wh, index) => {
        console.log(`   ${index + 1}. Event: ${wh.body.event}, ID: ${wh.body.id}`);
      });
      assert(receivedWebhooks.some((wh) => wh.body?.event === 'webhook.test'), 'Expected webhook.test event was not delivered');
    } else {
      throw new Error('No webhooks received');
    }
    console.log();
    
    // 7. 清理 - 删除测试 Webhook
    console.log('7️⃣ Cleaning up - deleting test webhook...');
    await deleteWebhook(token, webhook.id);
    createdWebhookId = null;
    console.log('✅ Test webhook deleted\n');
    
    console.log('🎉 All webhook tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    if (createdWebhookId) {
      try {
        const token = await getAuthToken();
        await deleteWebhook(token, createdWebhookId);
      } catch (cleanupError) {
        console.error('⚠️ Cleanup failed:', cleanupError.message);
      }
    }
    // 停止测试服务器
    stopWebhookServer();
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runWebhookTests().catch(console.error);
}

export { runWebhookTests };
