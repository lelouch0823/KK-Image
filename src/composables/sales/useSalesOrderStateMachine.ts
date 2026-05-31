import { ref } from 'vue';

const STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  EMPTY: 'empty',
  ERROR: 'error',
  RECOVERING: 'recovering',
} as const;

type StateValue = typeof STATES[keyof typeof STATES];

/** 状态机结果接口 */
interface StateMachineResult<T = unknown> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

/** 状态机动作接口 */
interface StateMachineActions {
  loadOrders?: (payload: unknown) => Promise<StateMachineResult>;
  createOrder?: (payload: unknown) => Promise<StateMachineResult>;
  loadDetail?: (payload: unknown) => Promise<StateMachineResult>;
  comment?: (payload: unknown) => Promise<StateMachineResult>;
}

/** API 返回的原始结果结构 */
interface RawResult {
  ok?: boolean;
  data?: unknown;
  error?: string | null;
  [key: string]: unknown;
}

const normalizeResult = (result: unknown): StateMachineResult => {
  if (!result || typeof result !== 'object') {
    return { ok: false, data: null, error: 'Invalid result' };
  }
  const raw = result as RawResult;
  return {
    ok: Boolean(raw.ok),
    data: raw.data ?? null,
    error: raw.error || null,
  };
};

export function useSalesOrderStateMachine(actions: StateMachineActions = {}) {
  const state = ref<StateValue>(STATES.IDLE);
  const error = ref<string | null>(null);
  let transitionRequestId = 0;

  const runTransition = async (actionName: string, actionRunner: () => Promise<StateMachineResult | undefined>, loadingState: StateValue = STATES.LOADING): Promise<StateMachineResult> => {
    const requestId = ++transitionRequestId;
    state.value = loadingState;
    error.value = null;

    const result = normalizeResult(await actionRunner());
    if (requestId !== transitionRequestId) {
      return result;
    }

    if (!result.ok) {
      state.value = STATES.ERROR;
      error.value = result.error || 'Operation failed';
      return result;
    }

    if (actionName === 'loadOrders') {
      const orders = Array.isArray(result.data) ? result.data : [];
      state.value = orders.length > 0 ? STATES.READY : STATES.EMPTY;
      return result;
    }

    state.value = STATES.READY;
    return result;
  };

  const loadOrders = (payload: unknown): Promise<StateMachineResult> =>
    runTransition('loadOrders', () => actions.loadOrders?.(payload), STATES.LOADING);

  const createOrder = (payload: unknown): Promise<StateMachineResult> =>
    runTransition('createOrder', () => actions.createOrder?.(payload), STATES.RECOVERING);

  const loadDetail = (payload: unknown): Promise<StateMachineResult> =>
    runTransition('loadDetail', () => actions.loadDetail?.(payload), STATES.LOADING);

  const comment = (payload: unknown): Promise<StateMachineResult> =>
    runTransition('comment', () => actions.comment?.(payload), STATES.RECOVERING);

  const retry = (targetAction: string = 'loadOrders', payload?: unknown): Promise<StateMachineResult> => {
    if (targetAction === 'createOrder') return createOrder(payload);
    if (targetAction === 'loadDetail') return loadDetail(payload);
    if (targetAction === 'comment') return comment(payload);
    return loadOrders(payload);
  };

  return {
    state,
    error,
    states: STATES,
    loadOrders,
    createOrder,
    loadDetail,
    comment,
    retry,
  };
}
