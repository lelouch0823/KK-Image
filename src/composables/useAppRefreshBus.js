import { shallowRef } from 'vue';

const lastRefreshEvent = shallowRef(null);
const listenersByModule = new Map();

function normalizeModuleKey(module) {
  return String(module || '').trim();
}

export function useAppRefreshBus() {
  const publishRefresh = (event = {}) => {
    const module = normalizeModuleKey(event.module);
    const payload = {
      timestamp: Date.now(),
      silent: true,
      ...event,
      module,
    };

    lastRefreshEvent.value = payload;

    const listeners = listenersByModule.get(module);
    if (!listeners || listeners.size === 0) return payload;

    for (const listener of listeners) {
      listener(payload);
    }

    return payload;
  };

  const subscribeModule = (module, handler) => {
    const key = normalizeModuleKey(module);
    if (!key || typeof handler !== 'function') {
      return () => {};
    }

    if (!listenersByModule.has(key)) {
      listenersByModule.set(key, new Set());
    }

    const listeners = listenersByModule.get(key);
    listeners.add(handler);

    return () => {
      listeners.delete(handler);
      if (listeners.size === 0) {
        listenersByModule.delete(key);
      }
    };
  };

  return {
    lastRefreshEvent,
    publishRefresh,
    subscribeModule,
  };
}

export function resetAppRefreshBusForTests() {
  lastRefreshEvent.value = null;
  listenersByModule.clear();
}
