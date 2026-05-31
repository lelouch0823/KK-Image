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

interface StateMachineResult {
  ok: boolean;
  data: any;
  error: string | null;
}

interface StateMachineActions {
  loadOrders?: (payload: any) => Promise<any>;
  createOrder?: (payload: any) => Promise<any>;
  loadDetail?: (payload: any) => Promise<any>;
  comment?: (payload: any) => Promise<any>;
}

const normalizeResult = (result: any): StateMachineResult => {
  if (!result || typeof result !== 'object') {
    return { ok: false, data: null, error: 'Invalid result' };
  }
  return {
    ok: Boolean(result.ok),
    data: result.data ?? null,
    error: result.error || null,
  };
};

export function useSalesOrderStateMachine(actions: StateMachineActions = {}) {
  const state = ref<StateValue>(STATES.IDLE);
  const error = ref<string | null>(null);
  let transitionRequestId = 0;

  const runTransition = async (actionName: string, actionRunner: () => Promise<any>, loadingState: StateValue = STATES.LOADING): Promise<StateMachineResult> => {
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

  const loadOrders = (payload: any): Promise<StateMachineResult> =>
    runTransition('loadOrders', () => actions.loadOrders?.(payload), STATES.LOADING);

  const createOrder = (payload: any): Promise<StateMachineResult> =>
    runTransition('createOrder', () => actions.createOrder?.(payload), STATES.RECOVERING);

  const loadDetail = (payload: any): Promise<StateMachineResult> =>
    runTransition('loadDetail', () => actions.loadDetail?.(payload), STATES.LOADING);

  const comment = (payload: any): Promise<StateMachineResult> =>
    runTransition('comment', () => actions.comment?.(payload), STATES.RECOVERING);

  const retry = (targetAction: string = 'loadOrders', payload?: any): Promise<StateMachineResult> => {
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
