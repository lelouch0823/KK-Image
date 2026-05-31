import { shallowRef, type Ref } from 'vue';

interface RefreshEvent {
  module?: string;
  timestamp?: number;
  silent?: boolean;
  [key: string]: unknown;
}

interface NormalizedRefreshEvent {
  module: string;
  timestamp: number;
  silent: boolean;
  [key: string]: unknown;
}

type RefreshListener = (event: NormalizedRefreshEvent) => void;

const lastRefreshEvent: Ref<NormalizedRefreshEvent | null> = shallowRef(null);
const listenersByModule = new Map<string, Set<RefreshListener>>();

function normalizeModuleKey(module?: string): string {
  return String(module || '').trim();
}

export function useAppRefreshBus() {
  const publishRefresh = (event: RefreshEvent = {}): NormalizedRefreshEvent => {
    const module = normalizeModuleKey(event.module);
    const payload: NormalizedRefreshEvent = {
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

  const subscribeModule = (module: string, handler: RefreshListener): (() => void) => {
    const key = normalizeModuleKey(module);
    if (!key || typeof handler !== 'function') {
      return () => {};
    }

    let listeners = listenersByModule.get(key);
    if (!listeners) {
      listeners = new Set();
      listenersByModule.set(key, listeners);
    }
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

export function resetAppRefreshBusForTests(): void {
  lastRefreshEvent.value = null;
  listenersByModule.clear();
}
