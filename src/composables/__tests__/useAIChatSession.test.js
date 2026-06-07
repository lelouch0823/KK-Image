import { beforeEach, describe, expect, it } from 'vitest';
import { useAIChatSession } from '../useAIChatSession.js';

describe('useAIChatSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a pending assistant message, applies stream updates, and finalizes once', () => {
    const session = useAIChatSession({
      storageKey: 'ai-chat-session-test',
      createWelcomeMessage: () => ({
        role: 'assistant',
        content: 'welcome',
        html: '<p>welcome</p>',
      }),
      renderAssistantHtml: (content) => `<p>${content}</p>`,
      fixFinalAssistantContent: (content) => content.trim(),
    });

    session.appendUserMessage([{ type: 'text', text: '帮我创建订单' }]);
    session.beginAssistantDraft();
    session.applyStreamState({ displayedContent: '正在整理', fullContent: '正在整理' });
    session.finalizeAssistantDraft('已整理完成');

    expect(session.messages.value.at(-1)).toEqual(
      expect.objectContaining({
        role: 'assistant',
        content: '已整理完成',
        html: '<p>已整理完成</p>',
      })
    );
  });

  it('drops an empty assistant draft after a failed stream', () => {
    const session = useAIChatSession({
      storageKey: 'ai-chat-session-test-empty',
      createWelcomeMessage: () => ({
        role: 'assistant',
        content: 'welcome',
        html: '<p>welcome</p>',
      }),
      renderAssistantHtml: (content) => `<p>${content}</p>`,
    });

    session.appendUserMessage([{ type: 'text', text: '测试' }]);
    session.beginAssistantDraft();
    session.discardEmptyAssistantDraft();

    expect(session.messages.value).toHaveLength(2);
    expect(session.messages.value.at(-1)).toEqual(expect.objectContaining({ role: 'user' }));
  });
});
