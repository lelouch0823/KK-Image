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
    S3: 's3'
};

/**
 * 存储提供者注册表
 * @type {Object<string, typeof import('./base-provider.js').BaseStorageProvider>}
 */
const providerRegistry = {
    [StorageProviderType.TELEGRAM]: TelegramStorageProvider,
    [StorageProviderType.R2]: R2StorageProvider,
    [StorageProviderType.S3]: S3StorageProvider
};

/**
 * 存储提供者实例缓存
 * @type {Map<string, import('./base-provider.js').BaseStorageProvider>}
 */
const providerCache = new Map();

/**
 * 获取存储提供者实例
 * @param {Object} env - Cloudflare Workers 环境对象
 * @param {string} [providerType] - 指定提供者类型，默认从环境变量读取
 * @returns {import('./base-provider.js').BaseStorageProvider}
 */
export function getStorageProvider(env, providerType = null) {
    // 确定使用的存储类型
    const type = providerType || env.STORAGE_PROVIDER || StorageProviderType.TELEGRAM;

    // 检查缓存
    const cacheKey = `${type}`;
    if (providerCache.has(cacheKey)) {
        return providerCache.get(cacheKey);
    }

    // 创建提供者实例
    const ProviderClass = providerRegistry[type.toLowerCase()];
    if (!ProviderClass) {
        console.warn(`Unknown storage provider: ${type}, falling back to Telegram`);
        return getStorageProvider(env, StorageProviderType.TELEGRAM);
    }

    const provider = new ProviderClass(env);

    // 检查配置是否有效
    if (!provider.isConfigured()) {
        console.warn(`Storage provider ${type} is not properly configured`);
        // 如果不是 Telegram，尝试回退到 Telegram
        if (type !== StorageProviderType.TELEGRAM) {
            console.warn('Falling back to Telegram storage');
            return getStorageProvider(env, StorageProviderType.TELEGRAM);
        }
    }

    // 缓存实例
    providerCache.set(cacheKey, provider);

    return provider;
}

/**
 * 根据文件元数据获取对应的存储提供者
 * @param {Object} env - 环境对象
 * @param {Object} metadata - 文件元数据
 * @returns {import('./base-provider.js').BaseStorageProvider}
 */
export function getProviderForFile(env, metadata) {
    // 如果元数据中有存储提供者信息，使用该提供者
    if (metadata?.storageProvider) {
        return getStorageProvider(env, metadata.storageProvider);
    }

    // 否则使用默认提供者（Telegram，保持向后兼容）
    return getStorageProvider(env, StorageProviderType.TELEGRAM);
}

/**
 * 获取所有已配置的存储提供者
 * @param {Object} env - 环境对象
 * @returns {Array<{type: string, name: string, configured: boolean}>}
 */
export function listAvailableProviders(env) {
    return Object.entries(providerRegistry).map(([type, ProviderClass]) => {
        const provider = new ProviderClass(env);
        return {
            type,
            name: provider.name,
            configured: provider.isConfigured()
        };
    });
}

/**
 * 清除提供者缓存
 */
export function clearProviderCache() {
    providerCache.clear();
}

// 导出基类和提供者类以便扩展
export { BaseStorageProvider } from './base-provider.js';
export { TelegramStorageProvider } from './providers/telegram.js';
export { R2StorageProvider } from './providers/r2.js';
export { S3StorageProvider } from './providers/s3.js';
