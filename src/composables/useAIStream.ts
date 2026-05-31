import { ref, computed, onScopeDispose } from 'vue';
import { API as API_URLS } from '@/utils/constants';
import { SSEParser } from '@/utils/streaming';
import { useSmoothTypewriter } from '@/composables/useSmoothTypewriter';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useRequestAdapters } from '@/composables/useRequestAdapters';
import { useAppRefreshBus } from '@/composables/useAppRefreshBus';
import { classifyStreamFailure } from '@/composables/ai/streamErrorState';
import {
    createInitialAIChatSessionState,
    finalizeAIChatSessionState,
    reduceAIChatSessionEvent,
} from '@/composables/ai/chatSessionState';

/* global TextDecoder */

interface StreamSanitizerOptions {
    dangerTags?: string[];
    carryLimit?: number;
}

interface StreamSanitizer {
    push: (text: string) => string;
    flush: () => string;
    reset: () => void;
}

interface AIStreamEvent {
    type: string;
    data?: Record<string, unknown>;
}

interface StreamState {
    actionCard?: Record<string, unknown> | null;
    toolStatus?: string;
    fullContent?: string;
    displayedContent?: string;
}

interface ClassifiedStreamError {
    message: string;
    isImageError: boolean;
    isHandled: boolean;
    kind: string;
}

/**
 * SOTA AI 流式数据处理 Composable
 * =================================
 * 封装 SSE 连接、解析、打字机队列以及工具调用状态。
 * 支持请求取消 (AbortController)。
 */
export function createStreamSanitizer(options: StreamSanitizerOptions = {}): StreamSanitizer {
    const dangerTags = Array.isArray(options.dangerTags) && options.dangerTags.length > 0
        ? options.dangerTags
        : ['tools', 'call', 'arg_key', 'arg_value', 'function_name', 'parameters', 'tool_code', 'thought', 'think', 'reasoning'];
    const carryLimit = Number.isFinite(options.carryLimit) ? options.carryLimit! : 256;
    const tagPattern = new RegExp(`</?(?:${dangerTags.join('|')})[^>]*>`, 'gi');
    let carry = '';

    return {
        push(text: string): string {
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
        flush(): string {
            const finalText = carry.replace(tagPattern, '');
            carry = '';
            return finalText;
        },
        reset(): void {
            carry = '';
        },
    };
}

export function classifyAIStreamError(rawMessage = ''): ClassifiedStreamError {
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

export function reduceAIStreamEvent(event: AIStreamEvent, state: StreamState, { publishRefresh }: { publishRefresh?: (data: Record<string, unknown>) => void } = {}): boolean {
    if (!event || typeof event !== 'object') return false;

    if (event.type === 'module_refresh') {
        publishRefresh?.(event.data || {});
        return true;
    }

    const nextState = reduceAIChatSessionEvent(event, {
        ...createInitialAIChatSessionState(),
        toolStatus: state.toolStatus || '',
        fullContent: state.fullContent || '',
        displayedContent: state.displayedContent || '',
        actionState: {
            status: state.actionCard?.type === 'slot_request'
                ? 'collecting_slots'
                : state.actionCard?.type === 'action_preview'
                    ? 'awaiting_confirmation'
                    : state.actionCard?.type === 'action_result'
                        ? 'submitted'
                        : 'idle',
            card: state.actionCard || null,
            error: null,
        },
    });

    if (nextState.actionState.card) {
        state.actionCard = nextState.actionState.card;
        if (Object.prototype.hasOwnProperty.call(state, 'toolStatus')) {
            state.toolStatus = nextState.toolStatus;
        }
        if (Object.prototype.hasOwnProperty.call(state, 'fullContent')) {
            state.fullContent = nextState.fullContent;
        }
        if (Object.prototype.hasOwnProperty.call(state, 'displayedContent')) {
            state.displayedContent = nextState.displayedContent;
        }
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
    const actionCard = ref<Record<string, unknown> | null>(null);
    const sessionState = ref(createInitialAIChatSessionState());

    // 请求取消控制器
    let abortController: AbortController | null = null;

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
     */
    const stream = async ({ messages, context }: { messages: unknown[]; context: Record<string, unknown> }): Promise<void> => {
        // 取消之前的请求
        if (abortController) {
            abortController.abort();
        }
        abortController = new AbortController();

        isLoading.value = true;
        isStreaming.value = false;
        toolStatus.value = '';
        actionCard.value = null;
        sessionState.value = reduceAIChatSessionEvent({ type: 'request_started' }, sessionState.value);
        resetTypewriter();

        const syncSessionState = (nextState: Record<string, unknown>): void => {
            sessionState.value = nextState;
            toolStatus.value = nextState.toolStatus as string;
            actionCard.value = nextState.actionState?.card as Record<string, unknown> | null;
        };

        try {
            const response = await requestAuth(API_URLS.AI.STREAM, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages, context }),
                signal: abortController.signal
            });

            isLoading.value = false;
            isStreaming.value = true;

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            const parser = new SSEParser();
            const sanitizer = createStreamSanitizer();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const parsedEvents = parser.feed(chunk);

                for (const event of parsedEvents) {
                    const handledActionEvent = reduceAIStreamEvent(event, {
                        actionCard: actionCard.value,
                        toolStatus: toolStatus.value,
                        fullContent: sessionState.value.fullContent,
                        displayedContent: sessionState.value.displayedContent,
                    }, { publishRefresh });
                    if (handledActionEvent) {
                        if (event.type !== 'module_refresh') {
                            syncSessionState(reduceAIChatSessionEvent(event, sessionState.value));
                        }
                        continue;
                    }

                    if (event.type === 'text_delta' && event.data?.content) {
                        const cleaned = sanitizer.push(event.data.content);
                        if (cleaned) {
                            syncSessionState(reduceAIChatSessionEvent({ type: 'text_delta', data: { content: cleaned } }, sessionState.value));
                            pushToTypewriter(cleaned);
                        }
                    } else if (event.type === 'content_block') {
                        if (event.data?.type === 'table' && event.data?.content) {
                            // 表格内容（工具调用结果）直接推送
                            syncSessionState(reduceAIChatSessionEvent({ type: 'content_block', data: { content: event.data.content } }, sessionState.value));
                            pushToTypewriter(event.data.content);
                        } else if (event.data?.content) {
                            syncSessionState(reduceAIChatSessionEvent({ type: 'content_block', data: { content: event.data.content } }, sessionState.value));
                            pushToTypewriter(event.data.content);
                        }
                    } else if (event.type === 'tool_call') {
                        syncSessionState(reduceAIChatSessionEvent(event, sessionState.value));
                    } else if (event.type === 'tool_result') {
                        syncSessionState(reduceAIChatSessionEvent(event, sessionState.value));
                    } else if (event.type === 'model_switch') {
                        // 模型切换通知
                        addToast({
                            message: t('ai.modelSwitch'),
                            type: 'info'
                        });
                    } else if (event.type === 'error') {
                        syncSessionState(reduceAIChatSessionEvent(event, sessionState.value));
                        const structured = classifyStreamFailure(event.data || {});
                        if (structured.category === 'tool_error' || structured.category === 'action_error') {
                            addToast({ message: structured.userMessage || t('ai.error'), type: 'error' });
                            const structuredError = new Error(structured.userMessage || 'Stream Error');
                            (structuredError as Error & { isHandled: boolean; category: string }).isHandled = true;
                            (structuredError as Error & { isHandled: boolean; category: string }).category = structured.category;
                            throw structuredError;
                        }
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
                        (error as Error & { isHandled: boolean; isImageError: boolean; imageErrorKind: string }).isHandled = true;
                        (error as Error & { isHandled: boolean; isImageError: boolean; imageErrorKind: string }).isImageError = classified.isImageError;
                        (error as Error & { isHandled: boolean; isImageError: boolean; imageErrorKind: string }).imageErrorKind = classified.kind;
                        throw error;
                    }
                }
            }

            const finalSanitized = sanitizer.flush();
            if (finalSanitized) {
                syncSessionState(reduceAIChatSessionEvent({ type: 'text_delta', data: { content: finalSanitized } }, sessionState.value));
                pushToTypewriter(finalSanitized);
            }
            syncSessionState(finalizeAIChatSessionState(sessionState.value));
        } catch (err) {
            // 忽略用户主动取消的请求
            if ((err as Error).name === 'AbortError') {
                // 用户主动取消，静默处理
                return;
            }
            console.error('AI Stream Error:', err);
            if (!(err as Error & { isHandled?: boolean }).isHandled) {
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
    const cancel = (): void => {
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
