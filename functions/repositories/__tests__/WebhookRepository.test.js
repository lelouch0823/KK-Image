import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookRepository } from '../WebhookRepository.js';

function createWebhookDbStub(seedRows = [], seedLogs = []) {
  const rows = seedRows.map((row) => ({ ...row }));
  const logs = seedLogs.map((row) => ({ ...row }));

  function createStatement(sql) {
    const normalizedSql = String(sql || '');
    const statement = {
      sql: normalizedSql,
      params: [],
      bind: vi.fn((...params) => {
        statement.params = params;
        return statement;
      }),
      all: vi.fn(async () => {
        if (normalizedSql.includes('FROM webhook_event_subscriptions')) {
          const [eventType] = statement.params;
          return {
            results: rows.filter(
              (row) =>
                Number(row.enabled) === 1 && JSON.parse(row.events || '[]').includes(eventType)
            ),
          };
        }

        if (
          normalizedSql.includes('FROM webhook_logs') &&
          normalizedSql.includes('GROUP BY delivery_key')
        ) {
          const deliveryKeys = statement.params;
          return {
            results: deliveryKeys
              .map((deliveryKey) => {
                const matched = logs.filter((row) => row.delivery_key === deliveryKey);
                if (matched.length === 0) return null;
                return {
                  delivery_key: deliveryKey,
                  has_success: matched.some((row) => Number(row.success) === 1) ? 1 : 0,
                  latest_attempt_number: Math.max(
                    ...matched.map((row) => Number(row.attempt_number || 0))
                  ),
                };
              })
              .filter(Boolean),
          };
        }

        return { results: [] };
      }),
      first: vi.fn(async () => {
        if (normalizedSql.includes('SELECT * FROM webhooks WHERE id = ?')) {
          const [id] = statement.params;
          return rows.find((row) => row.id === id) || null;
        }

        if (normalizedSql.includes('FROM webhook_logs') && normalizedSql.includes('success = 1')) {
          const [webhookId, deliveryKey] = statement.params;
          return (
            logs.find(
              (row) =>
                row.webhook_id === webhookId &&
                row.delivery_key === deliveryKey &&
                Number(row.success) === 1
            ) || null
          );
        }

        if (
          normalizedSql.includes('FROM webhook_logs') &&
          normalizedSql.includes('ORDER BY attempt_number DESC')
        ) {
          const [webhookId, deliveryKey] = statement.params;
          return (
            logs
              .filter((row) => row.webhook_id === webhookId && row.delivery_key === deliveryKey)
              .sort(
                (left, right) =>
                  Number(right.attempt_number || 0) - Number(left.attempt_number || 0)
              )[0] || null
          );
        }

        return null;
      }),
      run: vi.fn(async () => {
        if (normalizedSql.includes('INSERT INTO webhooks')) {
          const [id, url, events, secret, headers, enabled, createdBy, createdAt] =
            statement.params;
          rows.push({
            id,
            url,
            events,
            secret,
            headers,
            enabled,
            created_by: createdBy,
            created_at: createdAt,
            updated_by: null,
            updated_at: null,
          });
        }

        if (normalizedSql.includes('UPDATE webhooks') && normalizedSql.includes('SET')) {
          const [url, events, secret, headers, enabled, updatedBy, updatedAt, id] =
            statement.params;
          const row = rows.find((item) => item.id === id);
          if (row) {
            row.url = url;
            row.events = events;
            row.secret = secret;
            row.headers = headers;
            row.enabled = enabled;
            row.updated_by = updatedBy;
            row.updated_at = updatedAt;
          }
        }

        if (normalizedSql.includes('INSERT INTO webhook_logs')) {
          const [
            id,
            webhookId,
            eventType,
            payload,
            statusCode,
            response,
            durationMs,
            success,
            eventId,
            deliveryKey,
            attemptNumber,
            classification,
            nextRetryAt,
            createdAt,
          ] = statement.params;

          logs.push({
            id,
            webhook_id: webhookId,
            event: eventType,
            payload,
            status_code: statusCode,
            response,
            duration_ms: durationMs,
            success,
            event_id: eventId,
            delivery_key: deliveryKey,
            attempt_number: attemptNumber,
            classification,
            next_retry_at: nextRetryAt,
            created_at: createdAt,
          });
        }

        return { success: true, meta: { changes: 1 } };
      }),
    };

    return statement;
  }

  return {
    rows,
    logs,
    prepare: vi.fn((sql) => createStatement(sql)),
  };
}

describe('WebhookRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists active webhook endpoints subscribed to a domain event type', async () => {
    const db = createWebhookDbStub([
      {
        id: 'wh-1',
        url: 'https://example.com/a',
        events: JSON.stringify(['purchase_receipt_recorded']),
        secret: 'secret-a',
        headers: JSON.stringify({ 'X-Test': '1' }),
        enabled: 1,
        created_by: 'admin-1',
        created_at: 1710000000000,
      },
      {
        id: 'wh-2',
        url: 'https://example.com/b',
        events: JSON.stringify(['inventory_received']),
        secret: null,
        headers: JSON.stringify({}),
        enabled: 1,
        created_by: 'admin-1',
        created_at: 1710000000001,
      },
      {
        id: 'wh-3',
        url: 'https://example.com/c',
        events: JSON.stringify(['purchase_receipt_recorded']),
        secret: null,
        headers: JSON.stringify({}),
        enabled: 0,
        created_by: 'admin-1',
        created_at: 1710000000002,
      },
    ]);
    const repo = new WebhookRepository(db, {
      now: () => 1710000009999,
      idFactory: () => 'wh-created',
    });

    const result = await repo.listActiveByEvent('purchase_receipt_recorded');

    expect(result).toEqual([
      {
        id: 'wh-1',
        url: 'https://example.com/a',
        events: ['purchase_receipt_recorded'],
        hasSecret: true,
        secret: 'secret-a',
        headers: { 'X-Test': '1' },
        enabled: true,
        createdBy: 'admin-1',
        createdAt: 1710000000000,
        updatedBy: null,
        updatedAt: null,
      },
    ]);
  });

  it('batches delivery-state lookups by delivery key', async () => {
    const db = createWebhookDbStub(
      [],
      [
        {
          id: 'whlog-1',
          webhook_id: 'wh-1',
          delivery_key: 'evt-1:wh-1:v1',
          success: 1,
          attempt_number: 2,
        },
        {
          id: 'whlog-2',
          webhook_id: 'wh-2',
          delivery_key: 'evt-1:wh-2:v1',
          success: 0,
          attempt_number: 3,
        },
      ]
    );
    const repo = new WebhookRepository(db);

    const states = await repo.getDeliveryStates(['evt-1:wh-1:v1', 'evt-1:wh-2:v1']);

    expect(states.get('evt-1:wh-1:v1')).toEqual({
      deliveryKey: 'evt-1:wh-1:v1',
      hasSuccess: true,
      latestAttemptNumber: 2,
    });
    expect(states.get('evt-1:wh-2:v1')).toEqual({
      deliveryKey: 'evt-1:wh-2:v1',
      hasSuccess: false,
      latestAttemptNumber: 3,
    });
  });

  it('creates and updates manage webhook configs', async () => {
    const db = createWebhookDbStub();
    const repo = new WebhookRepository(db, {
      now: () => 1710000009999,
      idFactory: () => 'wh-created',
    });

    const created = await repo.create({
      url: 'https://example.com/hook',
      events: ['purchase_receipt_recorded'],
      secret: 'secret-a',
      headers: { 'X-KK': '1' },
      enabled: true,
      actorId: 'admin-1',
    });

    expect(created).toEqual(
      expect.objectContaining({
        id: 'wh-created',
        url: 'https://example.com/hook',
        events: ['purchase_receipt_recorded'],
        headers: { 'X-KK': '1' },
        enabled: true,
        createdBy: 'admin-1',
      })
    );

    const updated = await repo.update('wh-created', {
      url: 'https://example.com/hook-2',
      events: ['order_procurement_progressed'],
      secret: 'secret-b',
      headers: { 'X-KK': '2' },
      enabled: false,
      actorId: 'admin-2',
    });

    expect(updated).toEqual(
      expect.objectContaining({
        id: 'wh-created',
        url: 'https://example.com/hook-2',
        events: ['order_procurement_progressed'],
        headers: { 'X-KK': '2' },
        enabled: false,
        updatedBy: 'admin-2',
        updatedAt: 1710000009999,
      })
    );
  });

  it('stores immutable webhook attempts with delivery_key and attempt_number', async () => {
    const db = createWebhookDbStub([], []);
    const repo = new WebhookRepository(db, {
      now: () => 1710000011111,
      idFactory: () => 'ignored-for-logs',
      logIdFactory: () => 'whlog-1',
    });

    const result = await repo.logAttempt({
      webhookId: 'wh-1',
      eventId: 'evt-1',
      eventType: 'purchase_receipt_recorded',
      payload: { ok: true },
      statusCode: 202,
      response: 'accepted',
      durationMs: 345,
      deliveryKey: 'evt-1:wh-1:v1',
      attemptNumber: 2,
      classification: 'delivered',
      nextRetryAt: null,
      success: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'whlog-1',
        webhook_id: 'wh-1',
        event_id: 'evt-1',
        delivery_key: 'evt-1:wh-1:v1',
        attempt_number: 2,
        classification: 'delivered',
        success: 1,
      })
    );
  });

  it('detects that an endpoint has already succeeded for a delivery key', async () => {
    const db = createWebhookDbStub(
      [],
      [
        {
          id: 'whlog-1',
          webhook_id: 'wh-1',
          event: 'purchase_receipt_recorded',
          payload: '{"ok":true}',
          status_code: 200,
          response: 'ok',
          duration_ms: 120,
          success: 1,
          event_id: 'evt-1',
          delivery_key: 'evt-1:wh-1:v1',
          attempt_number: 1,
          classification: 'delivered',
          next_retry_at: null,
          created_at: 1710000000000,
        },
      ]
    );
    const repo = new WebhookRepository(db, {
      now: () => 1710000011111,
      idFactory: () => 'wh-created',
      logIdFactory: () => 'whlog-created',
    });

    const hasSuccess = await repo.hasSuccessfulDelivery('wh-1', 'evt-1:wh-1:v1');
    const latestAttempt = await repo.getLatestAttempt('wh-1', 'evt-1:wh-1:v1');

    expect(hasSuccess).toBe(true);
    expect(latestAttempt).toEqual(
      expect.objectContaining({
        id: 'whlog-1',
        delivery_key: 'evt-1:wh-1:v1',
        attempt_number: 1,
        classification: 'delivered',
      })
    );
  });
});
