/**
 * @fileoverview 智能存储路由器 - 根据规则选择最优存储
 * @module storage/router
 */

/**
 * @typedef {Object} RoutingRule
 * @property {string} [condition] - 条件表达式
 * @property {string} storage - 目标存储
 * @property {boolean} [default] - 是否为默认规则
 */

/**
 * 默认路由规则
 */
const DEFAULT_RULES = [
    // 小于 5MB 的文件使用 Telegram（免费无限）
    { condition: 'size < 5242880', storage: 'telegram' },
    // 视频文件使用 R2（适合大文件）
    { condition: 'type startsWith video/', storage: 'r2' },
    // 音频文件使用 R2
    { condition: 'type startsWith audio/', storage: 'r2' },
    // 默认使用 R2
    { default: true, storage: 'r2' }
];

/**
 * 智能存储路由器
 */
export class SmartRouter {
    /**
     * @param {Object} env - 环境变量
     */
    constructor(env) {
        this.env = env;
        this.rules = this._parseRules();
    }

    /**
     * 解析路由规则
     * @private
     */
    _parseRules() {
        try {
            if (this.env.STORAGE_RULES) {
                return JSON.parse(this.env.STORAGE_RULES);
            }
        } catch (error) {
            console.warn('Failed to parse STORAGE_RULES, using defaults:', error);
        }
        return DEFAULT_RULES;
    }

    /**
     * 选择最优存储
     * @param {File|Blob} file - 要上传的文件
     * @returns {string} 存储提供者名称
     */
    selectStorage(file) {
        const mode = this.env.STORAGE_MODE || 'single';

        // 如果是单一模式或冗余模式，直接使用主存储
        if (mode === 'single' || mode === 'redundant') {
            return this.env.STORAGE_PRIMARY || this.env.STORAGE_PROVIDER || 'telegram';
        }

        // 智能模式：根据规则选择
        for (const rule of this.rules) {
            if (rule.default) {
                return rule.storage;
            }

            if (this._matchCondition(file, rule.condition)) {
                return rule.storage;
            }
        }

        // 回退到主存储
        return this.env.STORAGE_PRIMARY || 'telegram';
    }

    /**
     * 获取镜像存储列表
     * @returns {string[]} 镜像存储名称列表
     */
    getMirrors() {
        const mode = this.env.STORAGE_MODE || 'single';

        if (mode !== 'redundant') {
            return [];
        }

        const mirrorsStr = this.env.STORAGE_MIRRORS || '';
        return mirrorsStr.split(',').map(s => s.trim()).filter(Boolean);
    }

    /**
     * 检查是否启用异步镜像
     * @returns {boolean}
     */
    isAsyncMirror() {
        return this.env.STORAGE_MIRROR_ASYNC === 'true';
    }

    /**
     * 匹配条件
     * @private
     */
    _matchCondition(file, condition) {
        if (!condition) return false;

        const fileInfo = {
            size: file.size || 0,
            type: file.type || '',
            name: file.name || ''
        };

        // 解析条件：size < 5242880, type startsWith image/
        const sizeMatch = condition.match(/^size\s*([<>=!]+)\s*(\d+)$/);
        if (sizeMatch) {
            const [, operator, value] = sizeMatch;
            return this._compareNumber(fileInfo.size, operator, parseInt(value));
        }

        const typeStartsMatch = condition.match(/^type\s+startsWith\s+(.+)$/);
        if (typeStartsMatch) {
            return fileInfo.type.startsWith(typeStartsMatch[1]);
        }

        const typeEndsMatch = condition.match(/^type\s+endsWith\s+(.+)$/);
        if (typeEndsMatch) {
            return fileInfo.type.endsWith(typeEndsMatch[1]);
        }

        const nameMatch = condition.match(/^name\s+matches\s+(.+)$/);
        if (nameMatch) {
            try {
                const regex = new RegExp(nameMatch[1], 'i');
                return regex.test(fileInfo.name);
            } catch {
                return false;
            }
        }

        return false;
    }

    /**
     * 数值比较
     * @private
     */
    _compareNumber(a, operator, b) {
        switch (operator) {
            case '<': return a < b;
            case '<=': return a <= b;
            case '>': return a > b;
            case '>=': return a >= b;
            case '==': return a === b;
            case '!=': return a !== b;
            default: return false;
        }
    }
}

/**
 * 获取回退链
 * @param {Object} env - 环境变量
 * @param {Object} [metadata] - 文件元数据
 * @returns {string[]} 回退顺序
 */
export function getFallbackChain(env, metadata) {
    // 首先尝试使用文件元数据中的存储信息
    const chain = [];

    if (metadata?.storage) {
        // 主存储优先
        if (metadata.storage.primary) {
            chain.push(metadata.storage.primary);
        }
        // 然后是镜像存储
        if (metadata.storage.mirrors) {
            for (const mirror of metadata.storage.mirrors) {
                if (mirror.status === 'synced' && !chain.includes(mirror.provider)) {
                    chain.push(mirror.provider);
                }
            }
        }
    }

    // 如果没有元数据，使用配置的回退链
    if (chain.length === 0) {
        const fallbackStr = env.STORAGE_FALLBACK_CHAIN || 'r2,s3,telegram';
        const fallbacks = fallbackStr.split(',').map(s => s.trim()).filter(Boolean);
        chain.push(...fallbacks);
    }

    return chain;
}

/**
 * 检查是否启用回退
 * @param {Object} env
 * @returns {boolean}
 */
export function isFallbackEnabled(env) {
    return env.STORAGE_FALLBACK_ENABLED !== 'false';
}

/**
 * 获取回退超时时间
 * @param {Object} env
 * @returns {number} 毫秒
 */
export function getFallbackTimeout(env) {
    return parseInt(env.STORAGE_FALLBACK_TIMEOUT || '3000', 10);
}
