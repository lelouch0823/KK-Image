import { useStorage } from '@vueuse/core';
import { renderMarkdown, fixIncompleteMarkdown } from '@/utils/ai-markdown';
import { throttle } from '@/utils/performance';

function createWelcomeMessage(content, renderAssistantHtml) {
  return {
    role: 'assistant',
    content,
    html: renderAssistantHtml(content),
  };
}

export function normalizeUserContentParts(content) {
  if (!Array.isArray(content)) return null;
  const parts = content.filter((part) => {
    if (part?.type === 'text' && typeof part.text === 'string') return true;
    if (part?.type === 'image_url' && typeof part.image_url?.url === 'string') return true;
    return false;
  });
  return parts.length > 0 ? parts : null;
}

export function normalizeStoredMessages(raw, { welcomeContent, renderAssistantHtml }) {
  if (!Array.isArray(raw)) return [createWelcomeMessage(welcomeContent, renderAssistantHtml)];

  const normalized = raw
    .map((msg) => {
      if (msg?.role === 'assistant' && typeof msg.content === 'string') {
        return {
          role: 'assistant',
          content: msg.content,
          html: typeof msg.html === 'string' && msg.html ? msg.html : renderAssistantHtml(msg.content),
        };
      }
      if (msg?.role === 'user') {
        const userParts = normalizeUserContentParts(msg.content);
        if (!userParts) return null;
        return {
          role: 'user',
          content: userParts,
          html: '',
        };
      }
      return null;
    })
    .filter(Boolean);

  return normalized.length > 0
    ? normalized
    : [createWelcomeMessage(welcomeContent, renderAssistantHtml)];
}

export function useAIChatSession(options = {}) {
  const storageKey = options.storageKey || 'ai-chat-messages-v2';
  const welcomeContent = options.welcomeContent || 'Hello';
  const renderAssistantHtml = options.renderAssistantHtml || renderMarkdown;
  const fixFinalAssistantContent = options.fixFinalAssistantContent || fixIncompleteMarkdown;

  const messages = useStorage(storageKey, [createWelcomeMessage(welcomeContent, renderAssistantHtml)]);
  messages.value = normalizeStoredMessages(messages.value, { welcomeContent, renderAssistantHtml });

  let pendingAssistantIndex = -1;

  const renderDraftHtml = throttle((content, targetMessage) => {
    if (targetMessage) {
      targetMessage.html = renderAssistantHtml(content);
    }
  }, 100);

  const resetMessages = () => {
    messages.value = [createWelcomeMessage(welcomeContent, renderAssistantHtml)];
    pendingAssistantIndex = -1;
  };

  const appendUserMessage = (content) => {
    const normalizedContent = normalizeUserContentParts(content);
    if (!normalizedContent) return null;

    const message = {
      role: 'user',
      content: normalizedContent,
      html: '',
    };
    messages.value.push(message);
    return message;
  };

  const getPendingAssistantDraft = () => {
    if (pendingAssistantIndex >= 0) {
      return messages.value[pendingAssistantIndex] || null;
    }

    const lastMessage = messages.value.at(-1);
    return lastMessage?.role === 'assistant' ? lastMessage : null;
  };

  const beginAssistantDraft = () => {
    const draft = {
      role: 'assistant',
      content: '',
      html: '',
    };
    messages.value.push(draft);
    pendingAssistantIndex = messages.value.length - 1;
    return draft;
  };

  const applyStreamState = ({ displayedContent = '', fullContent = '' } = {}) => {
    const draft = getPendingAssistantDraft();
    if (!draft) return null;

    draft.content = displayedContent;
    if (fullContent) {
      renderDraftHtml(fullContent, draft);
    }
    return draft;
  };

  const finalizeAssistantDraft = (content = '') => {
    const draft = getPendingAssistantDraft();
    if (!draft) return null;

    const normalizedContent = typeof content === 'string' ? fixFinalAssistantContent(content) : '';
    draft.content = normalizedContent;
    draft.html = normalizedContent ? renderAssistantHtml(normalizedContent) : '';

    if (!draft.content && !draft.html) {
      discardEmptyAssistantDraft();
      return null;
    }

    pendingAssistantIndex = -1;
    return draft;
  };

  const discardEmptyAssistantDraft = () => {
    const draft = getPendingAssistantDraft();
    if (!draft) return;

    if (!draft.content && !draft.html) {
      const index = pendingAssistantIndex >= 0 ? pendingAssistantIndex : messages.value.lastIndexOf(draft);
      if (index >= 0) {
        messages.value.splice(index, 1);
      }
    }
    pendingAssistantIndex = -1;
  };

  const removeImagesFromLatestUserMessage = () => {
    const lastUserMessage = [...messages.value].reverse().find((item) => item?.role === 'user');
    const userParts = normalizeUserContentParts(lastUserMessage?.content);
    if (!lastUserMessage || !userParts) return;
    lastUserMessage.content = userParts.filter((part) => part.type !== 'image_url');
  };

  return {
    messages,
    appendUserMessage,
    beginAssistantDraft,
    applyStreamState,
    finalizeAssistantDraft,
    discardEmptyAssistantDraft,
    resetMessages,
    removeImagesFromLatestUserMessage,
  };
}
