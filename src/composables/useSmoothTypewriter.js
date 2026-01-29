import { ref, onUnmounted } from 'vue';

/**
 * SOTA 丝滑打字机效果 Composable
 * =================================
 * 
 * 提供一种自适应的打字渲染效果，用于平滑网络传输产生的文字块抖动。
 * 
 * 特色：
 * - 自适应速度：如果缓冲区堆积过多，会自动加速（延迟补偿）。
 * - RAF 渲染：使用 requestAnimationFrame 实现原生 60fps 的流畅度。
 * - 响应式输出：直接提供用于界面显示的字符串响应式引用。
 */
export function useSmoothTypewriter() {
    /** @type {import('vue').Ref<string>} 界面当前显示的文本内容 */
    const displayedContent = ref('');
    /** @type {import('vue').Ref<string>} 完整的目标内容（用于 markdown 渲染） */
    const fullContent = ref('');
    /** @type {import('vue').Ref<boolean>} 是否正在打字中 */
    const isTyping = ref(false);

    let targetContent = '';    // 最终需要显示的完整目标文本
    let lastFrameTime = 0;     // 上一帧的时间戳
    let accumulatedTime = 0;   // 累积未处理的时间毫秒
    let rafId = null;          // requestAnimationFrame 的 ID

    // 组件卸载时自动清理定时器
    onUnmounted(() => {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    });

    // 参数配置
    const BASE_SPEED = 20;     // 基础速度：字符间隔毫秒 (约 50 字/秒)
    const MIN_SPEED = 5;       // 最高速度：加速模式下的最小间隔
    const MAX_LAG_CHARS = 50;  // 积压阈值：如果缓冲区超过 50 字，开始线性加速

    /**
     * 帧渲染计时器
     * @param {number} timestamp - 当前帧时间戳
     */
    const tick = (timestamp) => {
        if (!lastFrameTime) lastFrameTime = timestamp;
        const deltaTime = timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        accumulatedTime += deltaTime;

        // 根据剩余字数动态计算打字速度（缓冲区越大，速度越快）
        const charsRemaining = targetContent.length - displayedContent.value.length;
        let currentSpeed = BASE_SPEED;

        if (charsRemaining > MAX_LAG_CHARS) {
            // 线性加速：每多出一个字，速度缩短 1ms，直到达到 MIN_SPEED
            currentSpeed = Math.max(MIN_SPEED, BASE_SPEED - (charsRemaining - MAX_LAG_CHARS));
        }

        // 处理当前帧应当显示的字符数量
        while (accumulatedTime >= currentSpeed && displayedContent.value.length < targetContent.length) {
            const nextChar = targetContent[displayedContent.value.length];
            displayedContent.value += nextChar;
            accumulatedTime -= currentSpeed;
        }

        // 如果还有未显示的内容，继续申请下一帧
        if (displayedContent.value.length < targetContent.length) {
            isTyping.value = true;
            rafId = requestAnimationFrame(tick);
        } else {
            // 渲染完成，重置状态
            isTyping.value = false;
            rafId = null;
            lastFrameTime = 0;
            accumulatedTime = 0;
        }
    };

    /**
     * 将新内容推入打字机缓冲区。
     * @param {string} content - 接收到的流式文本片段。
     */
    const push = (content) => {
        if (!content) return;
        targetContent += content;
        fullContent.value = targetContent; // 同步更新响应式完整内容

        // 如果渲染循环未开启，则启动它
        if (!rafId) {
            isTyping.value = true;
            lastFrameTime = 0;
            rafId = requestAnimationFrame(tick);
        }
    };

    /**
     * 立即完成打字（跳过动画直接显示全部内容）。
     */
    const finish = () => {
        displayedContent.value = targetContent;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        isTyping.value = false;
    };

    /**
     * 重置打字机状态。
     */
    const reset = () => {
        targetContent = '';
        displayedContent.value = '';
        fullContent.value = ''; // 重置完整内容
        isTyping.value = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        lastFrameTime = 0;
        accumulatedTime = 0;
    };

    return {
        fullContent,
        displayedContent,
        isTyping,
        push,
        finish,
        reset
    };
}
