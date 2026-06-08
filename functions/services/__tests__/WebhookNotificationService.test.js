import { describe, expect, it, vi } from 'vitest';
import { WebhookNotificationService } from '../WebhookNotificationService.js';

describe('WebhookNotificationService', () => {
  it('does not follow redirects when sending configured notification webhooks', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    const service = new WebhookNotificationService(
      {},
      {
        fetch: fetchMock,
        settingsRepo: {
          getAllGrouped: vi.fn(async () => ({
            notifications: {
              NOTIFY_WEBHOOK_GENERIC_URL: 'https://hooks.example/notify',
              NOTIFY_WEBHOOK_GENERIC_ENABLED: 'true',
            },
          })),
        },
      }
    );

    const result = await service.notify('admin_notification_created', { title: 'Notice' });

    expect(result).toEqual([{ channel: 'generic', success: true, error: undefined }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.example/notify',
      expect.objectContaining({
        method: 'POST',
        redirect: 'manual',
        signal: expect.anything(),
      })
    );
  });

  it('rejects private notification webhook URLs before fetching', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    const service = new WebhookNotificationService(
      {},
      {
        fetch: fetchMock,
        settingsRepo: {
          getAllGrouped: vi.fn(async () => ({
            notifications: {
              NOTIFY_WEBHOOK_GENERIC_URL: 'http://[::ffff:127.0.0.1]/notify',
              NOTIFY_WEBHOOK_GENERIC_ENABLED: 'true',
            },
          })),
        },
      }
    );

    const result = await service.notify('admin_notification_created', { title: 'Notice' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        channel: 'generic',
        success: false,
        error: expect.stringContaining('内网地址'),
      }),
    ]);
  });
});
