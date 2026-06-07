import { describe, expect, it } from 'vitest';
import {
  createInitialAIChatSessionState,
  finalizeAIChatSessionState,
  reduceAIChatSessionEvent,
} from '../chatSessionState.js';

describe('reduceAIChatSessionEvent', () => {
  it('tracks stream phase, text buffers, and tool status without mutating action state', () => {
    const state = createInitialAIChatSessionState();
    const loading = reduceAIChatSessionEvent({ type: 'request_started' }, state);
    const delta = reduceAIChatSessionEvent(
      { type: 'text_delta', data: { content: '你好' } },
      loading
    );
    const tool = reduceAIChatSessionEvent(
      { type: 'tool_call', data: { name: 'searchProducts' } },
      delta
    );

    expect(tool.streamPhase).toBe('tool_running');
    expect(tool.toolStatus).toBe('searchProducts');
    expect(tool.fullContent).toBe('你好');
    expect(tool.displayedContent).toBe('你好');
    expect(tool.actionState.status).toBe('idle');
    expect(tool.actionState.card).toBeNull();
  });

  it('keeps action lifecycle separate from assistant text lifecycle', () => {
    const state = createInitialAIChatSessionState();
    const next = reduceAIChatSessionEvent(
      { type: 'slot_request', data: { sessionId: 'act-1', missingSlots: ['name'] } },
      state
    );

    expect(next.actionState.status).toBe('collecting_slots');
    expect(next.actionState.card).toEqual(
      expect.objectContaining({ type: 'slot_request', sessionId: 'act-1' })
    );
    expect(next.fullContent).toBe('');
    expect(next.displayedContent).toBe('');
    expect(next.streamPhase).toBe('idle');
  });

  it('finalizes the assistant draft with preserved content and completion status', () => {
    const state = {
      ...createInitialAIChatSessionState(),
      fullContent: '## 标题',
      displayedContent: '## 标题',
      streamPhase: 'streaming',
    };

    expect(finalizeAIChatSessionState(state)).toEqual(
      expect.objectContaining({
        finalAssistantContent: '## 标题',
        streamPhase: 'completed',
      })
    );
  });
});
