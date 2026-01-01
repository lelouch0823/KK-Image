#!/usr/bin/env node

/**
 * kk-life 部署验证脚本
 * 用于验证项目部署后的基本功能是否正常
 */

import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置
const CONFIG = {
  // 默认本地开发环境，可通过环境变量覆盖
  BASE_URL: process.env.DEPLOY_URL || 'http://localhost:8080',
  API_BASE: process.env.API_BASE || 'http://localhost:8080/api/v1',
  TIMEOUT: 10000, // 10秒超时

  // 测试用户凭据
  TEST_USERNAME: process.env.TEST_USERNAME || 'admin',
  TEST_PASSWORD: process.env.TEST_PASSWORD || '123'
};

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// HTTP 请求封装
async function request(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${CONFIG.TIMEOUT}ms`);
    }
    throw err;
  }
}

// 检查基础页面
async function checkBasicPages() {
  info('检查基础页面...');

  const pages = [
    { path: '/', name: '主页' },
    { path: '/admin', name: '管理页面' }
  ];

  for (const page of pages) {
    try {
      const response = await request(`${CONFIG.BASE_URL}${page.path}`);
      if (response.ok) {
        success(`${page.name} (${page.path}) - 状态: ${response.status}`);
      } else {
        warning(`${page.name} (${page.path}) - 状态: ${response.status}`);
      }
    } catch (err) {
      error(`${page.name} (${page.path}) - 错误: ${err.message}`);
    }
  }
}

// 检查静态资源
async function checkStaticAssets() {
  info('检查静态资源...');

  const assets = ['/favicon.ico'];

  for (const asset of assets) {
    try {
      const response = await request(`${CONFIG.BASE_URL}${asset}`);
      if (response.ok) {
        success(`静态资源 ${asset} - 状态: ${response.status}`);
      } else {
        warning(`静态资源 ${asset} - 状态: ${response.status}`);
      }
    } catch (err) {
      error(`静态资源 ${asset} - 错误: ${err.message}`);
    }
  }
}


// 检查 API 健康状态
async function checkAPIHealth() {
  info('检查 API 健康状态...');

  try {
    const response = await request(`${CONFIG.API_BASE}/health`);
    if (response.ok) {
      const data = await response.json();
      success(`API 健康检查 - 状态: ${data.status}`);
      return true;
    } else {
      error(`API 健康检查失败 - 状态: ${response.status}`);
      return false;
    }
  } catch (err) {
    error(`API 健康检查错误: ${err.message}`);
    return false;
  }
}

// 检查认证系统
async function checkAuthentication() {
  info('检查认证系统...');

  try {
    // 测试 JWT 认证
    const response = await request(`${CONFIG.API_BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: CONFIG.TEST_USERNAME,
        password: CONFIG.TEST_PASSWORD
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data.token) {
        success('JWT 认证系统正常');
        return data.data.token;
      } else {
        error('JWT 认证响应格式错误');
        return null;
      }
    } else {
      error(`JWT 认证失败 - 状态: ${response.status}`);
      return null;
    }
  } catch (err) {
    error(`认证系统错误: ${err.message}`);
    return null;
  }
}

// 检查 API 端点
async function checkAPIEndpoints(token) {
  if (!token) {
    warning('跳过 API 端点检查（无有效 token）');
    return;
  }

  info('检查 API 端点...');

  const endpoints = [
    { method: 'GET', path: '/files', name: '文件列表' },
    { method: 'GET', path: '/webhooks', name: 'Webhook 列表' },
    { method: 'GET', path: '/info', name: '系统信息' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await request(`${CONFIG.API_BASE}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        success(`${endpoint.name} API - 状态: ${response.status}`);
      } else {
        warning(`${endpoint.name} API - 状态: ${response.status}`);
      }
    } catch (err) {
      error(`${endpoint.name} API - 错误: ${err.message}`);
    }
  }
}

// 检查环境配置
async function checkEnvironmentConfig() {
  info('检查环境配置...');

  try {
    // 读取 wrangler.toml 检查配置
    const wranglerPath = join(__dirname, '..', 'wrangler.toml');
    const wranglerContent = readFileSync(wranglerPath, 'utf8');

    // 检查关键配置项
    const requiredConfigs = [
      'BASIC_USER',
      'BASIC_PASS',
      'TG_Bot_Token',
      'TG_Chat_ID'
    ];

    let configOk = true;
    for (const config of requiredConfigs) {
      if (wranglerContent.includes(config)) {
        success(`环境变量 ${config} 已配置`);
      } else {
        warning(`环境变量 ${config} 未找到`);
        configOk = false;
      }
    }

    // 检查 KV 命名空间
    const kvNamespaces = ['img_url', 'WEBHOOKS_KV', 'WEBHOOK_LOGS_KV'];
    for (const ns of kvNamespaces) {
      if (wranglerContent.includes(ns)) {
        success(`KV 命名空间 ${ns} 已配置`);
      } else {
        warning(`KV 命名空间 ${ns} 未找到`);
        configOk = false;
      }
    }

    return configOk;
  } catch (err) {
    error(`环境配置检查错误: ${err.message}`);
    return false;
  }
}

// 生成部署报告
function generateReport(results) {
  log('\n' + '='.repeat(50), 'bold');
  log('📋 部署验证报告', 'bold');
  log('='.repeat(50), 'bold');

  const { passed, failed, warnings } = results;

  log(`\n✅ 通过: ${passed} 项`);
  log(`❌ 失败: ${failed} 项`);
  log(`⚠️  警告: ${warnings} 项`);

  if (failed === 0) {
    log('\n🎉 部署验证通过！系统运行正常。', 'green');
  } else if (failed <= 2) {
    log('\n⚠️  部署基本正常，但存在一些问题需要关注。', 'yellow');
  } else {
    log('\n❌ 部署存在严重问题，需要立即修复。', 'red');
  }

  log('\n💡 建议：');
  log('- 检查所有失败的项目并修复');
  log('- 确保环境变量正确配置');
  log('- 验证 KV 命名空间已创建');
  log('- 测试核心功能是否正常工作');
}

// 主函数
async function main() {
  log('🚀 开始 kk-life 部署验证...', 'bold');
  log(`📍 目标地址: ${CONFIG.BASE_URL}\n`);

  let passed = 0, failed = 0, warnings = 0;

  // 统计结果的辅助函数
  const originalLog = console.log;
  console.log = (...args) => {
    const message = args.join(' ');
    if (message.includes('✅')) passed++;
    else if (message.includes('❌')) failed++;
    else if (message.includes('⚠️')) warnings++;
    originalLog(...args);
  };

  try {
    // 执行各项检查
    await checkBasicPages();
    await checkStaticAssets();
    const apiHealthy = await checkAPIHealth();
    const token = await checkAuthentication();
    await checkAPIEndpoints(token);
    await checkEnvironmentConfig();

    // 恢复原始 console.log
    console.log = originalLog;

    // 生成报告
    generateReport({ passed, failed, warnings });

    // 设置退出码
    process.exit(failed > 2 ? 1 : 0);

  } catch (err) {
    console.log = originalLog;
    error(`部署验证过程中发生错误: ${err.message}`);
    process.exit(1);
  }
}

// 运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runDeployCheck };
