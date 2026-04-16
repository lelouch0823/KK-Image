import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  notificationCreate: vi.fn(),
  notificationMarkAllAsReadForAdmin: vi.fn(),
  tagCreate: vi.fn(),
  tagAssignToFile: vi.fn(),
  tagRemoveFromFile: vi.fn(),
  fileFindTrash: vi.fn(),
  fileRestoreBatch: vi.fn(),
  fileDeleteBatch: vi.fn(),
  folderFindTrash: vi.fn(),
  folderRestore: vi.fn(),
  folderFindById: vi.fn(),
  folderDeleteRecursive: vi.fn(),
  folderGetAllStorageKeysRecursive: vi.fn(),
  backupDelete: vi.fn(),
  performStreamingBackup: vi.fn(),
  decrementRefCount: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  scheduleCacheInvalidation: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../repositories/NotificationRepository.js', () => ({
  NotificationRepository: vi.fn(() => ({
    listForAdmin: vi.fn(async () => []),
    create: mocks.notificationCreate,
    markAllAsReadForAdmin: mocks.notificationMarkAllAsReadForAdmin,
    markAsReadForAdmin: vi.fn(),
  })),
}));

vi.mock('../../../../../repositories/TagRepository.js', () => ({
  TagRepository: vi.fn(() => ({
    findAll: vi.fn(async () => []),
    create: mocks.tagCreate,
    assignToFile: mocks.tagAssignToFile,
    removeFromFile: mocks.tagRemoveFromFile,
  })),
}));

vi.mock('../../../../../repositories/FileRepository.js', () => ({
  FileRepository: vi.fn(() => ({
    findTrash: mocks.fileFindTrash,
    restoreBatch: mocks.fileRestoreBatch,
    deleteBatch: mocks.fileDeleteBatch,
  })),
}));

vi.mock('../../../../../repositories/FolderRepository.js', () => ({
  FolderRepository: vi.fn(() => ({
    findTrash: mocks.folderFindTrash,
    restore: mocks.folderRestore,
    findById: mocks.folderFindById,
    deleteRecursive: mocks.folderDeleteRecursive,
    getAllStorageKeysRecursive: mocks.folderGetAllStorageKeysRecursive,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => next(),
}));

vi.mock('../../_shared/cache-urls.js', () => ({
  getManageNotificationCacheUrls: vi.fn(() => ['http://localhost/api/manage/notifications']),
  getManageTagCacheUrls: vi.fn(() => ['http://localhost/api/manage/tags']),
}));

vi.mock('../../../_shared/route-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/route-helpers.js');
  return {
    ...actual,
    scheduleCacheInvalidation: mocks.scheduleCacheInvalidation,
  };
});

vi.mock('../../../../../api/utils/blob-utils.js', () => ({
  decrementRefCount: mocks.decrementRefCount,
}));

vi.mock('../../../../../api/utils/backup-utils.js', () => ({
  performStreamingBackup: mocks.performStreamingBackup,
}));

vi.mock('../../../_shared/utils.js', () => ({
  MSG: {
    COMMON: {
      INVALID_PARAMS: 'INVALID_PARAMS',
      CREATE_SUCCESS: 'CREATE_SUCCESS',
      UPDATE_SUCCESS: 'UPDATE_SUCCESS',
      OP_SUCCESS: 'OP_SUCCESS',
      DELETE_SUCCESS: 'DELETE_SUCCESS',
      RESTORE_SUCCESS: 'RESTORE_SUCCESS',
    },
  },
  generateId: vi.fn(() => 'tag-1'),
  now: vi.fn(() => 1000),
  getFileUrl: vi.fn((key) => (key ? `/file/${key}` : null)),
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import notificationsApp from '../notifications.js';
import tagsApp from '../tags.js';
import trashApp from '../trash.js';
import backupsApp from '../backups.js';

function createApp(basePath, route) {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.route(basePath, route);
  return app;
}

describe('manage ops support audit routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notificationCreate.mockResolvedValue({ id: 'notification-1', title: 'Alert' });
    mocks.notificationMarkAllAsReadForAdmin.mockResolvedValue(undefined);
    mocks.tagCreate.mockResolvedValue(undefined);
    mocks.tagAssignToFile.mockResolvedValue(undefined);
    mocks.tagRemoveFromFile.mockResolvedValue(undefined);
    mocks.fileFindTrash.mockResolvedValue([]);
    mocks.fileRestoreBatch.mockResolvedValue(undefined);
    mocks.fileDeleteBatch.mockResolvedValue(undefined);
    mocks.folderFindTrash.mockResolvedValue([]);
    mocks.folderRestore.mockResolvedValue(undefined);
    mocks.folderFindById.mockResolvedValue({ id: 'folder-1' });
    mocks.folderDeleteRecursive.mockResolvedValue(undefined);
    mocks.folderGetAllStorageKeysRecursive.mockResolvedValue([]);
    mocks.performStreamingBackup.mockResolvedValue({ filename: 'backup-1.zip', key: 'backup-1.zip' });
    mocks.decrementRefCount.mockResolvedValue(undefined);
    mocks.scheduleCacheInvalidation.mockImplementation(() => {});
  });

  it('audits admin notification creation', async () => {
    const app = createApp('/api/manage/notifications', notificationsApp);
    const waitUntil = vi.fn();
    const res = await app.request(
      'http://localhost/api/manage/notifications',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Alert', type: 'system', orderId: 'order-1' }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    const [publishedEvents, publishContext] = mocks.publish.mock.calls[0];
    expect(publishContext).toBeUndefined();
    expect(publishedEvents).toEqual([
      expect.objectContaining({
        event_type: 'admin_notification_created',
        aggregate_type: 'notification',
        aggregate_id: 'order-1',
        payload: expect.objectContaining({
          title: 'Alert',
          type: 'system',
          order_id: 'order-1',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'notification.create',
        targetId: null,
        target_label: 'Alert',
        metadata: { type: 'system', orderId: 'order-1' },
      })
    );
  });

  it('audits marking all admin notifications as read', async () => {
    const app = createApp('/api/manage/notifications', notificationsApp);
    const waitUntil = vi.fn();
    const res = await app.request(
      'http://localhost/api/manage/notifications/all/read',
      { method: 'POST' },
      { DB: {} },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.notificationMarkAllAsReadForAdmin).toHaveBeenCalledTimes(1);
    const [publishedEvents, publishContext] = mocks.publish.mock.calls[0];
    expect(publishContext).toBeUndefined();
    expect(publishedEvents).toEqual([
      expect.objectContaining({
        event_type: 'notification_read_by_admin',
        aggregate_type: 'notification',
        aggregate_id: 'all',
        payload: { notification_id: 'all' },
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'notification.read',
        targetId: 'all',
        summary: 'Marked all notifications as read',
      })
    );
  });

  it('audits tag creation', async () => {
    const app = createApp('/api/manage/tags', tagsApp);
    const waitUntil = vi.fn();
    const res = await app.request(
      'http://localhost/api/manage/tags',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Important', color: '#f00' }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    const tagId = data?.tag?.id;
    const [publishedEvents, publishContext] = mocks.publish.mock.calls[0];
    expect(publishContext).toBeUndefined();
    expect(publishedEvents).toEqual([
      expect.objectContaining({
        event_type: 'tag_created',
        aggregate_type: 'tag',
        aggregate_id: tagId,
        payload: { tag_id: tagId },
      }),
    ]);
    expect(mocks.runOutboxPoller).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'tag.create',
        targetId: tagId,
        target_label: 'Important',
      })
    );
  });

  it('audits trash empty as a destructive operation', async () => {
    mocks.fileFindTrash.mockResolvedValue([
      { id: 'file-1', storage_key: 'storage-1', content_hash: null, deleted_at: 2 },
    ]);
    mocks.folderFindTrash.mockResolvedValue([
      { id: 'folder-1', deleted_at: 1 },
    ]);
    const r2Delete = vi.fn(async () => undefined);
    const app = createApp('/api/manage/trash', trashApp);
    const env = {
      DB: {},
      R2_BUCKET: { delete: r2Delete },
    };

    const res = await app.request(
      'http://localhost/api/manage/trash/empty',
      { method: 'DELETE' },
      env,
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.fileDeleteBatch).toHaveBeenCalledWith(['file-1']);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'trash.empty',
        severity: 'critical',
        metadata: { fileCount: 1, folderCount: 1 },
      })
    );
  });

  it('audits backup creation as a critical operation', async () => {
    const app = createApp('/api/manage/backups', backupsApp);
    const res = await app.request(
      'http://localhost/api/manage/backups',
      { method: 'POST' },
      { R2_BACKUP_BUCKET: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.performStreamingBackup).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'backup.create',
        severity: 'critical',
        targetId: 'backup-1.zip',
        target_label: 'backup-1.zip',
      })
    );
  });
});
