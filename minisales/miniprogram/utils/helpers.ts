/**
 * 通用工具函数
 */

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm
 */
export function formatDateTime(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const h = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
}

/**
 * 格式化相对时间 (如 "3分钟前")
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
}

/**
 * 获取今天的日期字符串
 */
export function getToday(): string {
    return formatDate(new Date());
}

/**
 * 获取 N 个月后的日期字符串
 */
export function getDateAfterMonths(months: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return formatDate(date);
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function (this: any, ...args: Parameters<T>) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let lastTime = 0;
    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now();
        if (now - lastTime >= delay) {
            lastTime = now;
            fn.apply(this, args);
        }
    };
}
/**
 * 智能友好时间格式化 (如 "今天 12:30", "周三", "11/24")
 */
export function formatFriendlyTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // 今天
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        return `今天 ${h}:${m}`;
    }

    // 一周内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = ['日', '一', '二', '三', '四', '五', '六'];
        return `周${days[date.getDay()]}`;
    }

    // 更早 (MM/DD)
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
}

/**
 * 将未知值转换为有限数字
 */
export function toFiniteNumber(value: unknown, fallback: number = 0): number {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

/**
 * 从候选值中选取第一个非空字符串
 */
export function pickFirstString(values: unknown[], fallback: string = ''): string {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return fallback;
}

/**
 * 安全解析对象 JSON，失败时回退到默认值
 */
export function safeParseObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as T;
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as T;
            }
        } catch (_error) {
            return fallback;
        }
    }

    return fallback;
}

/**
 * 安全解析数组 JSON，失败时回退到默认值
 */
export function safeParseArray<T>(value: unknown, fallback: T[] = []): T[] {
    if (Array.isArray(value)) {
        return value as T[];
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed as T[];
            }
        } catch (_error) {
            return fallback;
        }
    }

    return fallback;
}

/**
 * 构建查询字符串，忽略空值
 */
export function buildQueryString(params: Record<string, unknown>): string {
    return Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
}

/**
 * 将后端文件字段解析为 mini 端可消费的路径
 */
export function resolveFilePath(path?: unknown, storageKey?: unknown): string {
    const direct = pickFirstString([path]);
    if (direct) {
        if (
            direct.startsWith('/') ||
            direct.startsWith('http://') ||
            direct.startsWith('https://') ||
            direct.startsWith('data:') ||
            direct.startsWith('blob:')
        ) {
            return direct;
        }

        return `/file/${direct}`;
    }

    const key = pickFirstString([storageKey]);
    if (key) {
        if (
            key.startsWith('/') ||
            key.startsWith('http://') ||
            key.startsWith('https://')
        ) {
            return key;
        }

        return `/file/${key}`;
    }
    return '';
}
