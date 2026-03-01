/**
 * SOTA 性能优化工具库
 * =================================
 * 包含节流 (Throttle) 和防抖 (Debounce) 等高频函数优化工具。
 */

/**
 * 节流函数 (Throttle)
 * 确保函数在指定时间间隔内只执行一次。
 * 适用于：滚动监听、实时预览渲染、高频点击防止。
 * 
 * @param {Function} fn - 需要执行的函数
 * @param {number} wait - 节流间隔（毫秒）
 * @returns {Function} - 节流后的函数
 */
export function throttle(fn, wait) {
    let lastTime = 0;
    let timer = null;
    return function (...args) {
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
 * 
 * @param {Function} fn - 需要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} - 防抖后的函数
 */
export function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}
