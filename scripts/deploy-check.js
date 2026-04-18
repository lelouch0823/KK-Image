#!/usr/bin/env node

/**
 * kk-life 部署验证脚本
 * 用于验证项目部署后的基本功能是否正常
 */

import fetch from 'node-fetch';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

export function createConfig(env = process.env) {
  return {
    BASE_URL: env.DEPLOY_URL || 'http://localhost:8080',
    API_BASE: env.API_BASE || 'http://localhost:8080/api/v1',
    TIMEOUT: 10000,
    TEST_USERNAME: env.TEST_USERNAME || 'admin',
    TEST_PASSWORD: env.TEST_PASSWORD || '123',
  };
}

export function createLogger(options = {}) {
  const writeLine = options.writeLine || ((line) => process.stdout.write(`${line}\n`));
  const counters = { passed: 0, failed: 0, warnings: 0 };

  function log(message, color = 'reset') {
    writeLine(`${colors[color] || colors.reset}${message}${colors.reset}`);
  }

  function success(message) {
    counters.passed += 1;
    log(`✅ ${message}`, 'green');
  }

  function error(message) {
    counters.failed += 1;
    log(`❌ ${message}`, 'red');
  }

  function warning(message) {
    counters.warnings += 1;
    log(`⚠️  ${message}`, 'yellow');
  }

  function info(message) {
    log(`ℹ️  ${message}`, 'blue');
  }

  return { counters, log, success, error, warning, info };
}

export async function request(url, options = {}, deps = {}) {
  const config = deps.config || createConfig();
  const fetchImpl = deps.fetchImpl || fetch;
  const setTimeoutImpl = deps.setTimeoutImpl || setTimeout;
  const clearTimeoutImpl = deps.clearTimeoutImpl || clearTimeout;
  const controller = new AbortController();
  const timeoutId = setTimeoutImpl(() => controller.abort(), config.TIMEOUT);

  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeoutImpl(timeoutId);
    return response;
  } catch (error) {
    clearTimeoutImpl(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${config.TIMEOUT}ms`);
    }
    throw error;
  }
}

export async function checkBasicPages(deps = {}) {
  const config = deps.config || createConfig();
  const logger = deps.logger || createLogger();
  logger.info('检查基础页面...');

  const pages = [
    { path: '/', name: '主页' },
    { path: '/admin', name: '管理页面' },
  ];

  for (const page of pages) {
    try {
      const response = await request(`${config.BASE_URL}${page.path}`, {}, deps);
      if (response.ok) {
        logger.success(`${page.name} (${page.path}) - 状态: ${response.status}`);
      } else {
        logger.warning(`${page.name} (${page.path}) - 状态: ${response.status}`);
      }
    } catch (error) {
      logger.error(`${page.name} (${page.path}) - 错误: ${error.message}`);
    }
  }
}

export async function checkStaticAssets(deps = {}) {
  const config = deps.config || createConfig();
  const logger = deps.logger || createLogger();
  logger.info('检查静态资源...');

  for (const asset of ['/favicon.ico']) {
    try {
      const response = await request(`${config.BASE_URL}${asset}`, {}, deps);
      if (response.ok) {
        logger.success(`静态资源 ${asset} - 状态: ${response.status}`);
      } else {
        logger.warning(`静态资源 ${asset} - 状态: ${response.status}`);
      }
    } catch (error) {
      logger.error(`静态资源 ${asset} - 错误: ${error.message}`);
    }
  }
}

export async function checkAPIHealth(deps = {}) {
  const config = deps.config || createConfig();
  const logger = deps.logger || createLogger();
  logger.info('检查 API 健康状态...');

  try {
    const response = await request(`${config.API_BASE}/health`, {}, deps);
    if (!response.ok) {
      logger.error(`API 健康检查失败 - 状态: ${response.status}`);
      return false;
    }

    const data = await response.json();
    logger.success(`API 健康检查 - 状态: ${data.status}`);
    return true;
  } catch (error) {
    logger.error(`API 健康检查错误: ${error.message}`);
    return false;
  }
}

export async function checkAuthentication(deps = {}) {
  const config = deps.config || createConfig();
  const logger = deps.logger || createLogger();
  logger.info('检查认证系统...');

  try {
    const response = await request(
      `${config.API_BASE}/auth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: config.TEST_USERNAME,
          password: config.TEST_PASSWORD,
        }),
      },
      deps
    );

    if (!response.ok) {
      logger.error(`JWT 认证失败 - 状态: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.success && data.data.token) {
      logger.success('JWT 认证系统正常');
      return data.data.token;
    }

    logger.error('JWT 认证响应格式错误');
    return null;
  } catch (error) {
    logger.error(`认证系统错误: ${error.message}`);
    return null;
  }
}

export async function checkAPIEndpoints(token, deps = {}) {
  const config = deps.config || createConfig();
  const logger = deps.logger || createLogger();

  if (!token) {
    logger.warning('跳过 API 端点检查（无有效 token）');
    return;
  }

  logger.info('检查 API 端点...');

  const endpoints = [
    { method: 'GET', path: '/files', name: '文件列表' },
    { method: 'GET', path: '/webhooks', name: 'Webhook 列表' },
    { method: 'GET', path: '/info', name: '系统信息' },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await request(
        `${config.API_BASE}${endpoint.path}`,
        {
          method: endpoint.method,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        deps
      );

      if (response.ok) {
        logger.success(`${endpoint.name} API - 状态: ${response.status}`);
      } else {
        logger.warning(`${endpoint.name} API - 状态: ${response.status}`);
      }
    } catch (error) {
      logger.error(`${endpoint.name} API - 错误: ${error.message}`);
    }
  }
}

export async function checkEnvironmentConfig(deps = {}) {
  const logger = deps.logger || createLogger();
  const readFileSyncImpl = deps.readFileSyncImpl || readFileSync;
  logger.info('检查环境配置...');

  try {
    const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
    const wranglerContent = readFileSyncImpl(wranglerPath, 'utf8');
    let configOk = true;

    for (const configKey of ['BASIC_USER', 'BASIC_PASS', 'TG_Bot_Token', 'TG_Chat_ID']) {
      if (wranglerContent.includes(configKey)) {
        logger.success(`环境变量 ${configKey} 已配置`);
      } else {
        logger.warning(`环境变量 ${configKey} 未找到`);
        configOk = false;
      }
    }

    for (const namespace of ['img_url', 'WEBHOOKS_KV', 'WEBHOOK_LOGS_KV']) {
      if (wranglerContent.includes(namespace)) {
        logger.success(`KV 命名空间 ${namespace} 已配置`);
      } else {
        logger.warning(`KV 命名空间 ${namespace} 未找到`);
        configOk = false;
      }
    }

    return configOk;
  } catch (error) {
    logger.error(`环境配置检查错误: ${error.message}`);
    return false;
  }
}

export function generateReport(results, deps = {}) {
  const logger = deps.logger || createLogger();
  logger.log(`\n${'='.repeat(50)}`, 'bold');
  logger.log('📋 部署验证报告', 'bold');
  logger.log('='.repeat(50), 'bold');

  logger.log(`\n✅ 通过: ${results.passed} 项`);
  logger.log(`❌ 失败: ${results.failed} 项`);
  logger.log(`⚠️  警告: ${results.warnings} 项`);

  if (results.failed === 0) {
    logger.log('\n🎉 部署验证通过！系统运行正常。', 'green');
  } else if (results.failed <= 2) {
    logger.log('\n⚠️  部署基本正常，但存在一些问题需要关注。', 'yellow');
  } else {
    logger.log('\n❌ 部署存在严重问题，需要立即修复。', 'red');
  }

  logger.log('\n💡 建议：');
  logger.log('- 检查所有失败的项目并修复');
  logger.log('- 确保环境变量正确配置');
  logger.log('- 验证 KV 命名空间已创建');
  logger.log('- 测试核心功能是否正常工作');
}

export async function runDeployCheckCli(options = {}) {
  const config = options.config || createConfig(options.env);
  const logger = options.logger || createLogger({ writeLine: options.writeLine });

  logger.log('🚀 开始 kk-life 部署验证...', 'bold');
  logger.log(`📍 目标地址: ${config.BASE_URL}\n`);

  try {
    await checkBasicPages({ ...options, config, logger });
    await checkStaticAssets({ ...options, config, logger });
    await checkAPIHealth({ ...options, config, logger });
    const token = await checkAuthentication({ ...options, config, logger });
    await checkAPIEndpoints(token, { ...options, config, logger });
    await checkEnvironmentConfig({ ...options, config, logger });

    generateReport(logger.counters, { logger });
    return logger.counters.failed > 2 ? 1 : 0;
  } catch (error) {
    logger.error(`部署验证过程中发生错误: ${error.message}`);
    return 1;
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
  const exitCode = await runDeployCheckCli();
  process.exit(exitCode);
}
