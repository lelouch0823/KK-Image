import { ref, computed } from 'vue';
import { SSEParser } from '@/utils/streaming';
import { useSmoothTypewriter } from '@/composables/useSmoothTypewriter';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

/* global TextDecoder */

/**
 * SOTA AI 流式数据处理 Composable
 * =================================
 * 封装 SSE 连接、解析、打字机队列以及工具调用状态。
 */
export function useAIStream() {
    const { t } = useI18n();
    const { addToast } = useToast();

    const isLoading = ref(false);
    const isStreaming = ref(false);
    const toolStatus = ref('');

    const {
        displayedContent,
        isTyping,
        push: pushToTypewriter,
        reset: resetTypewriter
    } = useSmoothTypewriter();

    /**
     * 发起流式 AI 请求
     * @param {Object} options 
     * @param {Array} options.messages - 历史消息
     * @param {Object} options.context - 环境上下文
     * @param {Function} options.onChart - 图表数据回调
     */
    const stream = async ({ messages, context, onChart }) => {
        isLoading.value = true;
        isStreaming.value = false;
        toolStatus.value = '';
        resetTypewriter();

        try {
            const response = await fetch('/api/ai/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages, context }),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            isLoading.value = false;
            isStreaming.value = true;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const parser = new SSEParser();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const parsedEvents = parser.feed(chunk);

                for (const event of parsedEvents) {
                    if (event.type === 'text_delta' && event.data?.content) {
                        pushToTypewriter(event.data.content);
                    } else if (event.type === 'content_block') {
                        if (event.data?.type === 'chart' && event.data?.data) {
                            onChart?.(event.data.data);
                        } else if (event.data?.type === 'table' && event.data?.content) {
                            // 表格内容（工具调用结果）直接推送
                            pushToTypewriter(event.data.content);
                        } else if (event.data?.content) {
                            pushToTypewriter(event.data.content);
                        }
                    } else if (event.type === 'tool_call') {
                        toolStatus.value = event.data?.name || '';
                    } else if (event.type === 'tool_result') {
                        toolStatus.value = '';
                    } else if (event.type === 'model_switch') {
                        // 模型切换通知
                        addToast({
                            message: t('ai.modelSwitch') || '模型已切换',
                            type: 'info'
                        });
                    } else if (event.type === 'error') {
                        addToast({ message: event.data?.message || t('ai.error'), type: 'error' });
                    }
                }
            }
        } catch (err) {
            console.error('AI Stream Error:', err);
            addToast({ message: t('ai.networkError'), type: 'error' });
            throw err;
        } finally {
            isLoading.value = false;
            isStreaming.value = false;
            toolStatus.value = '';
        }
    };

    const isThinking = computed(() => {
        if (isLoading.value) return true;
        if (isStreaming.value && !displayedContent.value && !toolStatus.value) return true;
        return false;
    });

    return {
        stream,
        displayedContent,
        isTyping,
        isLoading,
        isStreaming,
        isThinking,
        toolStatus,
        resetStream: resetTypewriter
    };
}
