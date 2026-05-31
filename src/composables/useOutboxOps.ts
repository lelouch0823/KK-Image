import { ref } from 'vue';
import { API } from '@/utils/constants';
import { useToast } from './useToast';
import { useI18n } from './useI18n';
import { useAuth } from './useAuth';
import { handleApiError } from '@/utils/api-helpers';

/** Outbox 事件接口 */
interface OutboxEvent {
  id: string;
  eventType: string;
  consumerName?: string;
  status?: string;
  payload?: unknown;
  createdAt?: string;
  [key: string]: unknown;
}

/** Outbox 事件详情接口 */
interface OutboxEventDetail extends OutboxEvent {
  retryCount?: number;
  lastError?: string;
  processedAt?: string;
  [key: string]: unknown;
}

/** 列表元数据接口 */
interface ListMeta {
  limit: number;
  isTruncated: boolean;
}

/** 重放结果接口 */
interface ReplayResult {
  success?: boolean;
  processed?: number;
  failed?: number;
  [key: string]: unknown;
}

/** API 通用响应结构 */
interface OutboxApiResponse {
  success: boolean;
  data?: OutboxEvent[] | OutboxEventDetail | ReplayResult;
  meta?: { limit?: number; isTruncated?: boolean };
  error?: string;
  message?: string;
  [key: string]: unknown;
}

function buildQuery(filters: Record<string, string> = {}): string {
  const params = new URLSearchParams();

  if (filters.eventType) params.set('eventType', filters.eventType);
  if (filters.consumerName) params.set('consumerName', filters.consumerName);
  if (filters.status) params.set('status', filters.status);

  return params.toString();
}

export function useOutboxOps() {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const { t } = useI18n();

  const events = ref<OutboxEvent[]>([]);
  const loading = ref<boolean>(false);
  const error = ref<string>('');
  const errorCode = ref<string | null>(null);
  const eventDetail = ref<OutboxEventDetail | null>(null);
  const listMeta = ref<ListMeta>({
    limit: 100,
    isTruncated: false,
  });
  const detailLoading = ref<boolean>(false);
  const replayLoading = ref<boolean>(false);
  const lastReplayResult = ref<ReplayResult | null>(null);
  let latestListRequestId = 0;
  let latestDetailRequestId = 0;

  const loadEvents = async (filters: Record<string, string> = {}): Promise<boolean> => {
    const requestId = ++latestListRequestId;
    loading.value = true;
    if (requestId === latestListRequestId) {
      error.value = '';
      errorCode.value = null;
    }

    try {
      const query = buildQuery(filters);
      const target = query ? `${API.MANAGE_OUTBOX}?${query}` : API.MANAGE_OUTBOX;
      const res = await authFetch(target);
      const json: OutboxApiResponse = await res.json();

      if (requestId !== latestListRequestId) {
        return false;
      }

      if (!json.success) {
        error.value = json.error || json.message || t('common.loadFailed');
        addToast({ message: error.value, type: 'error' });
        return false;
      }

      events.value = Array.isArray(json.data) ? json.data : [];
      listMeta.value = {
        limit: Number(json?.meta?.limit || 100),
        isTruncated: Boolean(json?.meta?.isTruncated),
      };
      return true;
    } catch (e: unknown) {
      if (requestId !== latestListRequestId) {
        return false;
      }
      const { code, message } = handleApiError(e, { t, addToast, fallbackKey: 'common.networkError' });
      errorCode.value = code;
      error.value = message;
      return false;
    } finally {
      if (requestId === latestListRequestId) {
        loading.value = false;
      }
    }
  };

  const loadEventDetail = async (eventId: string | null): Promise<OutboxEventDetail | null> => {
    if (!eventId) {
      latestDetailRequestId += 1;
      eventDetail.value = null;
      detailLoading.value = false;
      return null;
    }

    const requestId = ++latestDetailRequestId;
    detailLoading.value = true;
    try {
      const res = await authFetch(API.MANAGE_OUTBOX_BY_ID(eventId));
      const json: OutboxApiResponse = await res.json();

      if (requestId !== latestDetailRequestId) {
        return null;
      }

      if (!json.success) {
        addToast({ message: json.error || json.message || t('common.loadFailed'), type: 'error' });
        return null;
      }

      eventDetail.value = (json.data as OutboxEventDetail) || null;
      return eventDetail.value;
    } catch (e: unknown) {
      if (requestId !== latestDetailRequestId) {
        return null;
      }
      const message = e instanceof Error ? e.message : t('common.networkError');
      addToast({ message, type: 'error' });
      return null;
    } finally {
      if (requestId === latestDetailRequestId) {
        detailLoading.value = false;
      }
    }
  };

  const submitReplay = async (target: string, payload: Record<string, unknown>): Promise<ReplayResult | null> => {
    replayLoading.value = true;
    try {
      const res = await authFetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json: OutboxApiResponse = await res.json();

      if (!json.success) {
        addToast({ message: json.error || json.message || t('common.operationFailed'), type: 'error' });
        return null;
      }

      lastReplayResult.value = (json.data as ReplayResult) || null;
      return lastReplayResult.value;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('common.networkError');
      addToast({ message, type: 'error' });
      return null;
    } finally {
      replayLoading.value = false;
    }
  };

  const dryRunReplay = async (payload: Record<string, unknown>): Promise<ReplayResult | null> => submitReplay(API.MANAGE_AUDIT_REPLAY_DRY_RUN, payload);
  const executeReplay = async (payload: Record<string, unknown>): Promise<ReplayResult | null> => submitReplay(API.MANAGE_AUDIT_REPLAY_EXECUTE, payload);
  const clearReplayResult = (): void => {
    lastReplayResult.value = null;
  };

  return {
    events,
    loading,
    error,
    errorCode,
    eventDetail,
    listMeta,
    detailLoading,
    replayLoading,
    lastReplayResult,
    loadEvents,
    loadEventDetail,
    dryRunReplay,
    executeReplay,
    clearReplayResult,
  };
}
