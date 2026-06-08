import { describe, expect, it, vi } from 'vitest';
import { ErpSyncService } from '../ErpSyncService.js';

describe('ErpSyncService safety limits', () => {
  it('falls back when crypto.subtle.timingSafeEqual is unavailable', () => {
    const service = new ErpSyncService({ erpRepo: {} });
    const original = globalThis.crypto.subtle.timingSafeEqual;
    globalThis.crypto.subtle.timingSafeEqual = undefined;

    try {
      expect(service._timingSafeEqual('abc', 'abc')).toBe(true);
      expect(service._timingSafeEqual('abc', 'abd')).toBe(false);
      expect(service._timingSafeEqual('abc', 'abcd')).toBe(false);
    } finally {
      globalThis.crypto.subtle.timingSafeEqual = original;
    }
  });

  it('stops pull pagination at configured maxPages even when remote keeps hasMore true', async () => {
    const service = new ErpSyncService({
      erpRepo: {
        createSyncLog: vi.fn(async () => 'log-1'),
        getMappingByErpId: vi.fn(async () => null),
        upsertMapping: vi.fn(async () => undefined),
        updateSyncLog: vi.fn(async () => undefined),
      },
    });
    service._createLocalEntity = vi.fn(async () => 'local-1');
    const adapter = {
      listRemote: vi
        .fn()
        .mockResolvedValueOnce({ items: [{ id: 'erp-1' }], hasMore: true })
        .mockResolvedValueOnce({ items: [{ id: 'erp-2' }], hasMore: true })
        .mockResolvedValueOnce({ items: [{ id: 'erp-3' }], hasMore: false }),
    };

    const result = await service._pullEntities(
      { id: 'conn-1', config: { maxPages: 2 } },
      adapter,
      'product'
    );

    expect(adapter.listRemote).toHaveBeenCalledTimes(2);
    expect(result.pulled).toBe(2);
    expect(result.truncated).toBe(true);
  });

  it('accepts outbound sha256 base64 webhook signatures', async () => {
    const erpRepo = {
      getConnectionById: vi.fn(async () => ({
        id: 'conn-1',
        enabled: true,
        config: { webhook_secret: 'secret-1' },
      })),
      createSyncLog: vi.fn(async () => 'log-1'),
      getMappingByErpId: vi.fn(async () => null),
      updateSyncLog: vi.fn(async () => undefined),
    };
    const service = new ErpSyncService({ erpRepo });
    const rawBody = JSON.stringify({
      entity_type: 'product',
      entity_id: 'erp-product-1',
      action: 'delete',
    });
    const signature = `sha256=${await service._computeHmacBase64(rawBody, 'secret-1')}`;

    const result = await service.handleWebhook('conn-1', rawBody, signature);

    expect(result).toEqual({ success: true });
    expect(erpRepo.createSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: 'conn-1',
        entityType: 'product',
        erpId: 'erp-product-1',
      })
    );
    expect(erpRepo.updateSyncLog).toHaveBeenCalledWith('log-1', { status: 'success' });
  });

  it('marks invalid webhook signatures as unauthorized', async () => {
    const erpRepo = {
      getConnectionById: vi.fn(async () => ({
        id: 'conn-1',
        enabled: true,
        config: { webhook_secret: 'secret-1' },
      })),
      createSyncLog: vi.fn(),
    };
    const service = new ErpSyncService({ erpRepo });
    const rawBody = JSON.stringify({
      entity_type: 'product',
      entity_id: 'erp-product-1',
      action: 'delete',
    });

    await expect(service.handleWebhook('conn-1', rawBody, 'not-a-signature')).rejects.toMatchObject(
      { statusCode: 401 }
    );
    expect(erpRepo.createSyncLog).not.toHaveBeenCalled();
  });
});
