import { ref } from 'vue';

const STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  EMPTY: 'empty',
  ERROR: 'error',
  RECOVERING: 'recovering',
};

const normalizeResult = (result) => {
  if (!result || typeof result !== 'object') {
    return { ok: false, data: null, error: 'Invalid result' };
  }
  return {
    ok: Boolean(result.ok),
    data: result.data ?? null,
    error: result.error || null,
  };
};

export function useSalesOrderStateMachine(actions = {}) {
  const state = ref(STATES.IDLE);
  const error = ref(null);

  const runTransition = async (actionName, actionRunner, loadingState = STATES.LOADING) => {
    state.value = loadingState;
    error.value = null;

    const result = normalizeResult(await actionRunner());

    if (!result.ok) {
      state.value = STATES.ERROR;
      error.value = result.error || 'Operation failed';
      return result;
    }

    if (actionName === 'loadOrders') {
      const orders = Array.isArray(result.data?.orders) ? result.data.orders : [];
      state.value = orders.length > 0 ? STATES.READY : STATES.EMPTY;
      return result;
    }

    state.value = STATES.READY;
    return result;
  };

  const loadOrders = (payload) =>
    runTransition('loadOrders', () => actions.loadOrders?.(payload), STATES.LOADING);

  const createOrder = (payload) =>
    runTransition('createOrder', () => actions.createOrder?.(payload), STATES.RECOVERING);

  const loadDetail = (payload) =>
    runTransition('loadDetail', () => actions.loadDetail?.(payload), STATES.LOADING);

  const comment = (payload) =>
    runTransition('comment', () => actions.comment?.(payload), STATES.RECOVERING);

  const retry = (targetAction = 'loadOrders', payload) => {
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

