import { useI18n } from '@/composables/useI18n';

interface StreamFailureClassification {
  category: string;
  retainActionCard: boolean;
  userMessage: string;
}

export function classifyStreamFailure(payload: Record<string, any> = {}): StreamFailureClassification {
  const { t } = useI18n();
  const type = String(payload?.type || '').trim();
  if (type === 'tool_round_exhausted') {
    return {
      category: 'tool_error',
      retainActionCard: true,
      userMessage: t('ai.streamError.toolRoundExhausted', '当前请求过于复杂，建议缩小范围后重试。'),
    };
  }

  if (type === 'action_submit_failed' || type === 'action_error') {
    return {
      category: 'action_error',
      retainActionCard: true,
      userMessage: String(payload?.message || t('ai.streamError.actionFailed', '当前操作未完成，请调整后重试。')),
    };
  }

  if (type === 'network_error') {
    return {
      category: 'network_error',
      retainActionCard: true,
      userMessage: String(payload?.message || t('ai.streamError.networkError', '网络异常，请稍后重试。')),
    };
  }

  if (type === 'model_error') {
    return {
      category: 'model_error',
      retainActionCard: true,
      userMessage: String(payload?.message || t('ai.streamError.modelError', '模型响应异常，请稍后重试。')),
    };
  }

  if (type === 'input_error') {
    return {
      category: 'input_error',
      retainActionCard: true,
      userMessage: String(payload?.message || t('ai.streamError.inputError', '输入内容无效，请调整后重试。')),
    };
  }

  return {
    category: 'generic',
    retainActionCard: true,
    userMessage: String(payload?.message || ''),
  };
}
