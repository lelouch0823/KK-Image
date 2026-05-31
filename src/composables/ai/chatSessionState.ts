const ACTION_STATUS_BY_EVENT: Record<string, string> = {
  slot_request: 'collecting_slots',
  action_preview: 'awaiting_confirmation',
  action_submitted: 'submitted',
  action_result: 'completed',
  action_error: 'failed',
};

interface AIActionCard {
  type: string;
  [key: string]: unknown;
}

interface AIChatSessionState {
  fullContent: string;
  displayedContent: string;
  streamPhase: string;
  toolStatus: string;
  error: unknown;
  actionState: {
    status: string;
    card: AIActionCard | null;
    error: unknown;
  };
  finalAssistantContent?: string;
}

interface AIChatEvent {
  type: string;
  data?: Record<string, unknown>;
  message?: string;
}

function appendContent(state: AIChatSessionState, content: string): AIChatSessionState {
  if (!content) return state;
  return {
    ...state,
    fullContent: `${state.fullContent}${content}`,
    displayedContent: `${state.displayedContent}${content}`,
    streamPhase: state.toolStatus ? 'tool_running' : 'streaming',
  };
}

export function createInitialAIChatSessionState(): AIChatSessionState {
  return {
    fullContent: '',
    displayedContent: '',
    streamPhase: 'idle',
    toolStatus: '',
    error: null,
    actionState: {
      status: 'idle',
      card: null,
      error: null,
    },
  };
}

export function reduceAIChatSessionEvent(event: AIChatEvent, state: AIChatSessionState = createInitialAIChatSessionState()): AIChatSessionState {
  if (!event || typeof event !== 'object') return state;

  if (event.type === 'request_started') {
    return createInitialAIChatSessionState();
  }

  if (event.type === 'text_delta') {
    const content = typeof event.data?.content === 'string' ? event.data.content : '';
    return appendContent(state, content);
  }

  if (event.type === 'content_block') {
    const content = typeof event.data?.content === 'string' ? event.data.content : '';
    return appendContent(state, content);
  }

  if (event.type === 'tool_call') {
    const name = typeof event.data?.name === 'string' ? event.data.name : '';
    return {
      ...state,
      toolStatus: name,
      streamPhase: 'tool_running',
    };
  }

  if (event.type === 'tool_result') {
    return {
      ...state,
      toolStatus: '',
      streamPhase: state.fullContent ? 'streaming' : 'requesting',
    };
  }

  if (event.type === 'error') {
    return {
      ...state,
      error: event.data || { message: event.message || '' },
      streamPhase: 'failed',
    };
  }

  if (event.type === 'stream_completed' || event.type === 'done') {
    return finalizeAIChatSessionState(state);
  }

  if (Object.prototype.hasOwnProperty.call(ACTION_STATUS_BY_EVENT, event.type)) {
    return {
      ...state,
      actionState: {
        status: ACTION_STATUS_BY_EVENT[event.type],
        card: {
          type: event.type === 'action_submitted' ? 'action_result' : event.type,
          ...(event.data || {}),
        },
        error: event.type === 'action_error' ? event.data || null : null,
      },
    };
  }

  return state;
}

export function finalizeAIChatSessionState(state: AIChatSessionState = createInitialAIChatSessionState()): AIChatSessionState {
  return {
    ...state,
    streamPhase: state.error ? 'failed' : 'completed',
    finalAssistantContent: state.fullContent,
  };
}
