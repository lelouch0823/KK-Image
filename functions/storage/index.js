/**
 * @fileoverview 存储工厂 - 创建和管理存储提供者
 * @module storage/index
 */

import { TelegramStorageProvider } from './providers/telegram.js';
import { R2StorageProvider } from './providers/r2.js';
import { S3StorageProvider } from './providers/s3.js';

/**
 * 支持的存储提供者类型
 * @enum {string}
 */
export const StorageProviderType = {
  TELEGRAM: 'telegram',
  R2: 'r2',
  S3: 's3',
};

/**
 * 存储提供者注册表
 * @type {Object<string, typeof import('./base-provider.js').BaseStorageProvider>}
 */
const providerRegistry = {
  [StorageProviderType.TELEGRAM]: TelegramStorageProvider,
  [StorageProviderType.R2]: R2StorageProvider,
  [StorageProviderType.S3]: S3StorageProvider,
};

/**
 * 存储提供者实例缓存
 * @type {Map<string, import('./base-provider.js').BaseStorageProvider>}
 */
const providerCache = new WeakMap();

function getProviderCacheBucket(env) {
  if (!env || typeof env !== 'object') {
    return null;
  }

  let bucket = providerCache.get(env);
  if (!bucket) {
    bucket = new Map();
    providerCache.set(env, bucket);
  }
  return bucket;
}

/**
 * 获取存储提供者实例
 * @param {Object} env - Cloudflare Workers 环境对象
 * @param {string} [providerType] - 指定提供者类型，默认从环境变量读取
 * @returns {import('./base-provider.js').BaseStorageProvider}
 */
export function getStorageProvider(env, providerType = null) {
  // 确定使用的存储类型
  const type = String(providerType || env.STORAGE_PROVIDER || StorageProviderType.R2).toLowerCase();
  const cacheBucket = getProviderCacheBucket(env);

  // 检查缓存
  if (cacheBucket?.has(type)) {
    return cacheBucket.get(type);
  }

  // 创建提供者实例
  const ProviderClass = providerRegistry[type.toLowerCase()];
  if (!ProviderClass) {
    console.warn(`Unknown storage provider: ${type}, falling back to R2`);
    return getStorageProvider(env, StorageProviderType.R2);
  }

  const provider = new ProviderClass(env);

  // 检查配置是否有效
  if (!provider.isConfigured()) {
    console.warn(`Storage provider ${type} is not properly configured`);
    // 非默认 R2 配置失效时，回退到 R2
    if (type !== StorageProviderType.R2) {
      console.warn('Falling back to R2 storage');
      return getStorageProvider(env, StorageProviderType.R2);
    }
  }

  // 缓存实例
  cacheBucket?.set(type, provider);

  return provider;
}
