import { ref, computed, onScopeDispose } from 'vue';
import { API as API_URLS } from '@/utils/constants';
import { SSEParser } from '@/utils/streaming';
import { useSmoothTypewriter } from '@/composables/useSmoothTypewriter';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useRequestAdapters } from '@/composables/useRequestAdapters';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';

/* global TextDecoder */

/**
 * SOTA AI 流式数据处理 Composable
 * =================================
 * 封装 SSE 连接、解析、打字机队列以及工具调用状态。
 * 支持请求取消 (AbortController)。
 */
export function createStreamSanitizer(options = {}) {
    const dangerTags = Array.isArray(options.dangerTags) && options.dangerTags.length > 0
        ? options.dangerTags
        : ['tools', 'call', 'arg_key', 'arg_value', 'function_name', 'parameters', 'tool_code', 'thought', 'think', 'reasoning'];
    const carryLimit = Number.isFinite(options.carryLimit) ? options.carryLimit : 256;
    const tagPattern = new RegExp(`</?(?:${dangerTags.join('|')})[^>]*>`, 'gi');
    let carry = '';

    return {
        push(text) {
            const incoming = String(text || '');
            if (!incoming) return '';

            const merged = carry + incoming;
            let cleaned = merged.replace(tagPattern, '');
            if (cleaned.length <= carryLimit) {
                carry = cleaned;
                return '';
            }

            const emit = cleaned.slice(0, -carryLimit);
            carry = cleaned.slice(-carryLimit);
            return emit;
        },
        flush() {
            const finalText = carry.replace(tagPattern, '');
            carry = '';
            return finalText;
        },
        reset() {
            carry = '';
        },
    };
}

export function classifyAIStreamError(rawMessage = '') {
    const message = String(rawMessage || '');
    const lower = message.toLowerCase();
    const hasBadRequestMarker = lower.includes('400') || lower.includes('invalid_parameter');
    const hasImageMarker = ['image', 'vision', 'multimodal', 'image_url', 'input_image', 'not support', 'not_supported']
        .some((keyword) => lower.includes(keyword));
    const hasFormatMarker = [
        'data:image',
        'base64',
        'invalid image',
        'invalid_image',
        'invalid image_url',
        'invalid_image_url',
        'image_url.url',
        'unsupported image format',
        'unsupported_format',
        'format not supported',
    ].some((keyword) => lower.includes(keyword));
    const hasCapabilityMarker = [
        'vision not supported',
        'multimodal not supported',
        'does not support image',
        'model not support image',
        'model does not support image',
    ].some((keyword) => lower.includes(keyword));
    const isImageError = hasBadRequestMarker && hasImageMarker;
    let kind = 'generic';
    if (isImageError && hasFormatMarker) {
        kind = 'image_input_format';
    } else if (isImageError && hasCapabilityMarker) {
        kind = 'model_capability';
    } else if (isImageError) {
        kind = 'image_generic';
    }

    return {
        message,
        isImageError,
        isHandled: isImageError,
        kind,
    };
}

export function reduceAIStreamEvent(event, state, { publishRefresh } = {}) {
    if (!event || typeof event !== 'object') return false;

    if (event.type === 'slot_request' || event.type === 'action_preview') {
        state.actionCard = {
            type: event.type,
            ...(event.data || {}),
        };
        return true;
    }

    if (event.type === 'action_submitted') {
        state.actionCard = {
            type: 'action_result',
            ...(event.data || {}),
        };
        return true;
    }

    if (event.type === 'module_refresh') {
        publishRefresh?.(event.data || {});
        return true;
    }

    return false;
}

export function useAIStream() {
    const { t } = useI18n();
    const { addToast } = useToast();
    const { requestAuth } = useRequestAdapters();
    const { publishRefresh } = useAppRefreshBus();

    const isLoading = ref(false);
    const isStreaming = ref(false);
    const toolStatus = ref('');
    const actionCard = ref(null);

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
        actionCard.value = null;
        resetTypewriter();

        try {
            const response = await requestAuth(API_URLS.AI.STREAM, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages, context }),
                signal: abortController.signal
            });

            isLoading.value = false;
            isStreaming.value = true;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const parser = new SSEParser();
            const sanitizer = createStreamSanitizer();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const parsedEvents = parser.feed(chunk);

                for (const event of parsedEvents) {
                    const handledActionEvent = reduceAIStreamEvent(event, { actionCard: actionCard.value }, { publishRefresh });
                    if (handledActionEvent) {
                        if (event.type !== 'module_refresh') {
                            actionCard.value = {
                                type: event.type === 'action_submitted' ? 'action_result' : event.type,
                                ...(event.data || {}),
                            };
                        }
                        continue;
                    }

                    if (event.type === 'text_delta' && event.data?.content) {
                        const cleaned = sanitizer.push(event.data.content);
                        if (cleaned) {
                            pushToTypewriter(cleaned);
                        }
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
                        const classified = classifyAIStreamError(event.data?.message || '');
                        if (classified.kind === 'image_input_format') {
                            addToast({
                                message: t(
                                    'ai.imageInputNotSupported',
                                    '当前 API 网关不接受该图片输入格式，请优先使用 JPG/PNG，或切换支持 data URL 的多模态模型。'
                                ),
                                type: 'error',
                            });
                        } else if (classified.isImageError) {
                            addToast({ message: t('ai.modelImageNotSupported', '当前模型不支持识别图片，请移除图片或切换模型。'), type: 'error' });
                        } else {
                            addToast({ message: classified.message || t('ai.error'), type: 'error' });
                        }

                        const error = new Error(classified.message || 'Stream Error');
                        error.isHandled = true;
                        error.isImageError = classified.isImageError;
                        error.imageErrorKind = classified.kind;
                        throw error;
                    }
                }
            }

            const finalSanitized = sanitizer.flush();
            if (finalSanitized) {
                pushToTypewriter(finalSanitized);
            }
        } catch (err) {
            // 忽略用户主动取消的请求
            if (err.name === 'AbortError') {
                // 用户主动取消，静默处理
                return;
            }
            console.error('AI Stream Error:', err);
            if (!err.isHandled) {
                addToast({ message: t('ai.networkError'), type: 'error' });
            }
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
        if (isLoading.value) return true;
        if (isStreaming.value) {
            if (toolStatus.value) return true;
            if (!displayedContent.value?.trim()) return true;
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
        actionCard,
        resetStream: resetTypewriter
    };
}
