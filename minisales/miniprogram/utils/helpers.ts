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
