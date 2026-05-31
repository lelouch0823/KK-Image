/**
 * SOTA 性能优化工具库
 * =================================
 * 包含节流 (Throttle) 和防抖 (Debounce) 等高频函数优化工具。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any; // 保留此类型别名用于通用函数工具

/**
 * 节流函数 (Throttle)
 * 确保函数在指定时间间隔内只执行一次。
 * 适用于：滚动监听、实时预览渲染、高频点击防止。
 */
export function throttle<T extends AnyFunction>(fn: T, wait: number): (...args: Parameters<T>) => void {
    let lastTime = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
        const now = Date.now();
        const remaining = wait - (now - lastTime);
        if (remaining <= 0) {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            fn.apply(this, args);
            lastTime = now;
        } else if (!timer) {
            timer = setTimeout(() => {
                fn.apply(this, args);
                lastTime = Date.now();
                timer = null;
            }, remaining);
        }
    };
}

/**
 * 防抖函数 (Debounce)
 * 只有在事件停止触发指定时间后才执行函数。
 * 适用于：搜索框输入、窗口大小调整。
 */
export function debounce<T extends AnyFunction>(fn: T, delay: number): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}
