import { ref, computed, onScopeDispose } from 'vue';
import { API as API_URLS } from '@/utils/constants';
import { SSEParser } from '@/utils/streaming';
import { useSmoothTypewriter } from '@/composables/useSmoothTypewriter';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

/* global TextDecoder */

/**
 * SOTA AI 流式数据处理 Composable
 * =================================
 * 封装 SSE 连接、解析、打字机队列以及工具调用状态。
 * 支持请求取消 (AbortController)。
 */
export function useAIStream() {
    const { t } = useI18n();
    const { addToast } = useToast();

    const isLoading = ref(false);
    const isStreaming = ref(false);
    const toolStatus = ref('');

    // 请求取消控制器
    let abortController = null;

    // 组件卸载时自动取消请求
    onScopeDispose(() => {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
    });

    const {
        fullContent,
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
     */
    const stream = async ({ messages, context }) => {
        // 取消之前的请求
        if (abortController) {
            abortController.abort();
        }
        abortController = new AbortController();

        isLoading.value = true;
        isStreaming.value = false;
        toolStatus.value = '';
        resetTypewriter();

        try {
            const response = await fetch(API_URLS.AI.STREAM, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages, context }),
                signal: abortController.signal
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
                        if (event.data?.type === 'table' && event.data?.content) {
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
                            message: t('ai.modelSwitch'),
                            type: 'info'
                        });
                    } else if (event.type === 'error') {
                        addToast({ message: event.data?.message || t('ai.error'), type: 'error' });
                    }
                }
            }
        } catch (err) {
            // 忽略用户主动取消的请求
            if (err.name === 'AbortError') {
                // 用户主动取消，静默处理
                return;
            }
            console.error('AI Stream Error:', err);
            addToast({ message: t('ai.networkError'), type: 'error' });
            throw err;
        } finally {
            isLoading.value = false;
            isStreaming.value = false;
            toolStatus.value = '';
            abortController = null;
        }
    };

    /**
     * 取消当前进行中的请求
     */
    const cancel = () => {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        isLoading.value = false;
        isStreaming.value = false;
        toolStatus.value = '';
    };

    const isThinking = computed(() => {
        // 1. 网络请求载入中
        if (isLoading.value) return true;
        
        // 2. 流式传输已经开启
        if (isStreaming.value) {
            // 如果正在调用工具，显示 Loading (通过 toolStatus 表现)
            if (toolStatus.value) return true;
            
            // 过滤掉内部标签后的可见内容
            const visibleText = (displayedContent.value || '')
                .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
                .replace(/<thought>[\s\S]*$/gi, '')
                .replace(/<(?:tools|call|arg_key|arg_value|function_name|parameters|tool_code)[^>]*>[\s\S]*?<\/(?:tools|call|arg_key|arg_value|function_name|parameters|tool_code)>/gi, '')
                .replace(/<(?:tools|call|arg_key|arg_value|function_name|parameters|tool_code)[^>]*>/gi, '')
                .replace(/<\/(?:tools|call|arg_key|arg_value|function_name|parameters|tool_code)>/gi, '')
                .replace(/^(searchVariants|getOrderStats|getRecentPending|getCustomerStats|getSpaceStats|getSalespersonStats|getFileStats|searchOrders|searchProducts|searchCustomers|getOrderDetail|getProductDetail|getVariantDetail|getCustomerDetail|getGoodsOverviewSummary|getGoodsOverviewList)\s*$/gm, '')
                .trim();

            // 如果还没有任何“可见”内容，或者正在等待下一段话，显示 Loading
            if (!visibleText) return true;
            if (!isTyping.value) return true;
        }
        
        return false;
    });

    return {
        stream,
        cancel,
        fullContent,
        displayedContent,
        isTyping,
        isLoading,
        isStreaming,
        isThinking,
        toolStatus,
        resetStream: resetTypewriter
    };
}
