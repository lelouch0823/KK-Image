import { useStorage } from '@vueuse/core';
import { renderMarkdown, fixIncompleteMarkdown } from '@/utils/ai-markdown';
import { throttle } from '@/utils/performance';

interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string | ContentPart[];
  html: string;
}

interface AIChatSessionOptions {
  storageKey?: string;
  welcomeContent?: string;
  renderAssistantHtml?: (content: string) => string;
  fixFinalAssistantContent?: (content: string) => string;
}

function createWelcomeMessage(content: string, renderAssistantHtml: (content: string) => string): ChatMessage {
  return {
    role: 'assistant',
    content,
    html: renderAssistantHtml(content),
  };
}

export function normalizeUserContentParts(content: unknown): ContentPart[] | null {
  if (!Array.isArray(content)) return null;
  const parts = (content as unknown[]).filter((part): part is ContentPart => {
    const p = part as ContentPart;
    if (p?.type === 'text' && typeof p.text === 'string') return true;
    if (p?.type === 'image_url' && typeof p.image_url?.url === 'string') return true;
    return false;
  });
  return parts.length > 0 ? parts : null;
}

export function normalizeStoredMessages(
  raw: unknown,
  { welcomeContent, renderAssistantHtml }: { welcomeContent: string; renderAssistantHtml: (content: string) => string }
): ChatMessage[] {
  if (!Array.isArray(raw)) return [createWelcomeMessage(welcomeContent, renderAssistantHtml)];

  const normalized = (raw as unknown[])
    .map((msg): ChatMessage | null => {
      const m = msg as ChatMessage;
      if (m?.role === 'assistant' && typeof m.content === 'string') {
        return {
          role: 'assistant',
          content: m.content,
          html: typeof m.html === 'string' && m.html ? m.html : renderAssistantHtml(m.content),
        };
      }
      if (m?.role === 'user') {
        const userParts = normalizeUserContentParts(m.content);
        if (!userParts) return null;
        return {
          role: 'user',
          content: userParts,
          html: '',
        };
      }
      return null;
    })
    .filter((msg): msg is ChatMessage => Boolean(msg));

  return normalized.length > 0
    ? normalized
    : [createWelcomeMessage(welcomeContent, renderAssistantHtml)];
}

export function useAIChatSession(options: AIChatSessionOptions = {}) {
  const storageKey = options.storageKey || 'ai-chat-messages-v2';
  const welcomeContent = options.welcomeContent || 'Hello';
  const renderAssistantHtml = options.renderAssistantHtml || renderMarkdown;
  const fixFinalAssistantContent = options.fixFinalAssistantContent || fixIncompleteMarkdown;

  const messages = useStorage<ChatMessage[]>(storageKey, [createWelcomeMessage(welcomeContent, renderAssistantHtml)]);
  messages.value = normalizeStoredMessages(messages.value, { welcomeContent, renderAssistantHtml });

  let pendingAssistantIndex = -1;

  const renderDraftHtml = throttle((content: string, targetMessage: ChatMessage | null) => {
    if (targetMessage) {
      targetMessage.html = renderAssistantHtml(content);
    }
  }, 100);

  const resetMessages = (): void => {
    messages.value = [createWelcomeMessage(welcomeContent, renderAssistantHtml)];
    pendingAssistantIndex = -1;
  };

  const appendUserMessage = (content: unknown): ChatMessage | null => {
    const normalizedContent = normalizeUserContentParts(content);
    if (!normalizedContent) return null;

    const message: ChatMessage = {
      role: 'user',
      content: normalizedContent,
      html: '',
    };
    messages.value.push(message);
    return message;
  };

  const getPendingAssistantDraft = (): ChatMessage | null => {
    if (pendingAssistantIndex >= 0) {
      return messages.value[pendingAssistantIndex] || null;
    }

    const lastMessage = messages.value.at(-1);
    return lastMessage?.role === 'assistant' ? lastMessage : null;
  };

  const beginAssistantDraft = (): ChatMessage => {
    const draft: ChatMessage = {
      role: 'assistant',
      content: '',
      html: '',
    };
    messages.value.push(draft);
    pendingAssistantIndex = messages.value.length - 1;
    return draft;
  };

  const applyStreamState = ({ displayedContent = '', fullContent = '' }: { displayedContent?: string; fullContent?: string } = {}): ChatMessage | null => {
    const draft = getPendingAssistantDraft();
    if (!draft) return null;

    draft.content = displayedContent;
    if (fullContent) {
      renderDraftHtml(fullContent, draft);
    }
    return draft;
  };

  const finalizeAssistantDraft = (content = ''): ChatMessage | null => {
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

  const discardEmptyAssistantDraft = (): void => {
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

  const removeImagesFromLatestUserMessage = (): void => {
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
