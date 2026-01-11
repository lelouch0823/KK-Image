import { ref } from 'vue';

/**
 * SOTA Smooth Typewriter Composable
 * =================================
 * 
 * Provides an adaptive typewriter effect that smooths out network jitter.
 * 
 * Features:
 * - Adaptive Speed: Accelerates if the buffer grows too large (lag compensation).
 * - RAF Loop: Uses requestAnimationFrame for native 60fps smoothness.
 * - Reactive Output: Directly provides the current display string.
 */
export function useSmoothTypewriter() {
    const displayedContent = ref('');
    const isTyping = ref(false);

    let targetContent = '';
    let lastFrameTime = 0;
    let accumulatedTime = 0;
    let rafId = null;

    // Configuration
    const BASE_SPEED = 20; // ms per character (approx 50 chars/sec)
    const MIN_SPEED = 5;   // Fastest allowed (catch up mode)
    const MAX_LAG_CHARS = 50; // If buffer > 50 chars, accelerate

    const tick = (timestamp) => {
        if (!lastFrameTime) lastFrameTime = timestamp;
        const deltaTime = timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        accumulatedTime += deltaTime;

        // Calculate dynamic speed based on buffer size
        const charsRemaining = targetContent.length - displayedContent.value.length;
        let currentSpeed = BASE_SPEED;

        if (charsRemaining > MAX_LAG_CHARS) {
            // Accelerate linearly as buffer grows
            currentSpeed = Math.max(MIN_SPEED, BASE_SPEED - (charsRemaining - MAX_LAG_CHARS));
        }

        // Process characters
        while (accumulatedTime >= currentSpeed && displayedContent.value.length < targetContent.length) {
            const nextChar = targetContent[displayedContent.value.length];
            displayedContent.value += nextChar;
            accumulatedTime -= currentSpeed;
        }

        if (displayedContent.value.length < targetContent.length) {
            isTyping.value = true;
            rafId = requestAnimationFrame(tick);
        } else {
            isTyping.value = false;
            rafId = null;
            lastFrameTime = 0;
            accumulatedTime = 0;
        }
    };

    /**
     * Append new content to the typewriter buffer.
     * @param {string} content - The chunk of text to separate.
     */
    const push = (content) => {
        if (!content) return;
        targetContent += content;

        if (!rafId) {
            isTyping.value = true;
            lastFrameTime = 0;
            rafId = requestAnimationFrame(tick);
        }
    };

    /**
     * Immediately complete the typing (skip animation).
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
     * Reset the typewriter state.
     */
    const reset = () => {
        targetContent = '';
        displayedContent.value = '';
        isTyping.value = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        lastFrameTime = 0;
        accumulatedTime = 0;
    };

    return {
        displayedContent,
        isTyping,
        push,
        finish,
        reset
    };
}
