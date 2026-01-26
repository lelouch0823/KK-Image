import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';

import {
  generateId,
  generateShareToken,
  timestampToIso,
  MSG,
  getShareUrl,
  getFileUrl,
} from '../../_shared/utils.js';

import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { FileRepository } from '../../../../repositories/FileRepository.js';

const app = new Hono();

// Schemas
const CreateFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  parentId: z.string().optional().nullable(),
  isPublic: z.boolean().optional().default(false),
  password: z.string().min(4).max(50).optional().nullable(),
});

const UpdateFolderSchema = CreateFolderSchema.partial().extend({
  shareExpiresAt: z.number().optional().nullable(),
});

/**
 * GET /api/manage/folders - 获取文件夹列表
 */
app.get('/', async (c) => {
  const { env } = c;
  const url = new URL(c.req.url);
  const parentId = url.searchParams.get('parent_id') || null;
  const all = url.searchParams.get('all') === 'true';
  const folderRepo = new FolderRepository(env.DB);

  try {
    let results;
    if (all) {
      results = await folderRepo.findAllMinimal();
    } else if (parentId) {
      results = await folderRepo.findByParent(parentId);
    } else {
      results = await folderRepo.findTopLevel();
    }

    return c.json({
      success: true,
      data: results.map((folder) => ({
        ...folder,
        isPublic: Boolean(folder.is_public),
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
        subfolderCount: folder.subfolder_count,
        fileCount: folder.file_count,
      })),
    });
  } catch (err) {
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * GET /api/manage/folders/:id - 获取文件夹详情
 */
app.get('/:id', async (c) => {
  const { env } = c;
  const folderId = c.req.param('id');
  const folderRepo = new FolderRepository(env.DB);
  const fileRepo = new FileRepository(env.DB);

  try {
    const folder = await folderRepo.findById(folderId);
    if (!folder) {
      return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
    }

    // 并行获取子文件夹和文件
    const [subfolders, files, breadcrumbs] = await Promise.all([
      folderRepo.findByParent(folderId),
      fileRepo.findByFolder(folderId),
      folderRepo.getBreadcrumbs(folderId)
    ]);

    return c.json({
      success: true,
      data: {
        id: folder.id,
        name: folder.name,
        description: folder.description,
        parentId: folder.parent_id,
        shareToken: folder.share_token,
        isPublic: Boolean(folder.is_public),
        hasPassword: !!folder.password,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
        shareUrl: getShareUrl(folder.share_token),
        breadcrumbs,
        subfolders: subfolders.map((f) => ({
          id: f.id,
          name: f.name,
          subfolderCount: f.subfolder_count,
          fileCount: f.file_count,
          isPublic: Boolean(f.is_public),
          createdAt: f.created_at,
        })),
        files: files.map((f) => ({
          id: f.id,
          name: f.name,
          originalName: f.original_name,
          size: f.size,
          mimeType: f.mime_type,
          url: getFileUrl(f.storage_key),
          createdAt: f.created_at,
        })),
      },
    });
  } catch (err) {
    console.error(`${MSG.COMMON.LOAD_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.LOAD_FAILED}: ${err.message}` }, 500);
  }
});

/**
 * POST /api/manage/folders - 创建文件夹
 */
app.post(
  '/',
  requirePermission('folders:write'),
  zValidator('json', CreateFolderSchema),
  async (c) => {
    const { env } = c;
    const { name, description, parentId, isPublic, password } = c.req.valid('json');
    const folderRepo = new FolderRepository(env.DB);

    try {
      if (parentId) {
        const parent = await folderRepo.findById(parentId);
        if (!parent) {
          return c.json({ success: false, error: MSG.FOLDER.PARENT_NOT_FOUND }, 400);
        }
      }

      const folderId = generateId();
      const shareToken = isPublic ? generateShareToken() : null;
      const nowMs = Date.now();

      await folderRepo.create({
        id: folderId,
        parentId: parentId || null,
        name: name.trim(),
        description: description.trim(),
        shareToken,
        isPublic,
        password: password || null,
        createdAt: nowMs,
        updatedAt: nowMs
      });

      return c.json(
        {
          success: true,
          data: {
            id: folderId,
            name: name.trim(),
            description: description.trim(),
            parentId,
            shareToken,
            isPublic,
            shareUrl: getShareUrl(shareToken),
            createdAt: nowMs,
          },
        },
        201
      );
    } catch (err) {
      console.error(`${MSG.COMMON.CREATE_FAILED}:`, err);
      return c.json({ success: false, error: `${MSG.COMMON.CREATE_FAILED}: ${err.message}` }, 500);
    }
  }
);

/**
 * PUT /api/manage/folders/:id - 更新文件夹
 */
app.put(
  '/:id',
  requirePermission('folders:write'),
  zValidator('json', UpdateFolderSchema),
  async (c) => {
    const { env } = c;
    const folderId = c.req.param('id');
    const data = c.req.valid('json');
    const folderRepo = new FolderRepository(env.DB);

    try {
      const folder = await folderRepo.findById(folderId);
      if (!folder) {
        return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
      }

      const updates = [];
      const values = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name.trim());
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description.trim());
      }
      if (data.isPublic !== undefined) {
        updates.push('is_public = ?');
        values.push(data.isPublic ? 1 : 0);
      }
      if (data.password !== undefined) {
        updates.push('password = ?');
        values.push(data.password || null);
      }
      if (data.parentId !== undefined) {
        if (data.parentId === folderId) {
          return c.json({ success: false, error: MSG.FOLDER.MOVE_TO_SELF }, 400);
        }
        updates.push('parent_id = ?');
        values.push(data.parentId);
      }
      if (data.shareExpiresAt !== undefined) {
        updates.push('share_expires_at = ?');
        values.push(data.shareExpiresAt);
      }

      // 自动生成分享令牌
      if ((data.isPublic === true || data.shareExpiresAt !== undefined) && !folder.share_token) {
        updates.push('share_token = ?');
        values.push(generateShareToken());
      }

      updates.push('updated_at = ?');
      values.push(Date.now());
      values.push(folderId);

      const updated = await folderRepo.update(folderId, updates, values);

      return c.json({
        success: true,
        data: {
          ...updated,
          isPublic: Boolean(updated.is_public),
          shareUrl: getShareUrl(updated.share_token),
        },
      });
    } catch (err) {
      console.error(`${MSG.COMMON.UPDATE_FAILED}:`, err);
      return c.json({ success: false, error: `${MSG.COMMON.UPDATE_FAILED}: ${err.message}` }, 500);
    }
  }
);

/**
 * DELETE /api/manage/folders/:id - 删除文件夹
 */
app.delete('/:id', requirePermission('folders:delete'), async (c) => {
  const { env } = c;
  const folderId = c.req.param('id');
  const folderRepo = new FolderRepository(env.DB);

  try {
    if (folderId === 'root') {
      return c.json({ success: false, error: MSG.FOLDER.ROOT_CANNOT_DELETE }, 400);
    }

    const folder = await folderRepo.findById(folderId);
    if (!folder) {
      return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
    }

    if (folder.is_system) {
      return c.json({ success: false, error: MSG.FOLDER.SYSTEM_FOLDER_DELETE }, 403);
    }

    // 获取所有子文件的存储键 (递归)
    const storageKeys = await folderRepo.getAllStorageKeysRecursive(folderId);

    // 从 R2 删除文件
    if (env.R2_BUCKET && storageKeys.length > 0) {
      await Promise.all(storageKeys.map((key) => env.R2_BUCKET.delete(key).catch(() => { })));
    }

    // 删除文件夹（级联删除）
    await folderRepo.deleteRecursive(folderId);

    return c.json({ success: true, message: MSG.FOLDER.DELETE_SUCCESS });
  } catch (err) {
    console.error(`${MSG.COMMON.DELETE_FAILED}:`, err);
    return c.json({ success: false, error: `${MSG.COMMON.DELETE_FAILED}: ${err.message}` }, 500);
  }
});

import { RedundancyManager } from '../../../../storage/redundancy.js';
import { triggerWebhook } from '../../_shared/utils.js';

/**
 * POST /api/manage/folders/:id/upload - 上传文件到文件夹
 */
app.post('/:id/upload', requirePermission('files:write'), async (c) => {
  const folderId = c.req.param('id');
  const { env } = c;
  const user = c.get('user');

  try {
    // 1. 验证文件夹是否存在
    const folder = await env.DB.prepare('SELECT id FROM folders WHERE id = ?')
      .bind(folderId)
      .first();
    if (!folder) {
      return c.json({ success: false, error: MSG.FOLDER.NOT_FOUND }, 404);
    }

    // 2. 获取上传文件
    const formData = await c.req.parseBody();
    const uploadFile = formData['file']; // Hono uses ['file'] for file input

    if (!uploadFile || !(uploadFile instanceof File)) {
      return c.json({ success: false, error: MSG.COMMON.UPLOAD_NO_FILE }, 400);
    }

    const fileName = uploadFile.name;
    const fileSize = uploadFile.size;
    const fileType = uploadFile.type;

    // 3. 使用 RedundancyManager 处理存储
    // 构建 context 模拟对象，适配 RedundancyManager
    const mockContext = {
      request: c.req.raw,
      env: env,
      waitUntil: (promise) => c.executionCtx.waitUntil(promise),
    };

    const redundancyManager = new RedundancyManager(env, mockContext);
    const result = await redundancyManager.upload(uploadFile, {
      fileName: fileName,
      contentType: fileType,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    const fileId = result.fileId;
    const nowMs = Date.now();

    // 4. 保存数据库记录
    const fileRepo = new FileRepository(env.DB);
    await fileRepo.create({
      id: fileId,
      folderId: folderId,
      name: fileName,
      originalName: fileName,
      size: fileSize,
      mimeType: fileType,
      storageKey: fileId,
      createdBy: user.id,
      createdAt: nowMs,
      updatedAt: nowMs
    });

    // 5. 触发 Webhook
    const fileInfo = {
      id: fileId,
      filename: fileName,
      size: fileSize,
      type: fileType,
      uploadTime: timestampToIso(nowMs),
      url: getFileUrl(fileId),
      uploader: user.name || user.username || user.id,
      storage: result.metadata?.storage,
    };

    c.executionCtx.waitUntil(
      (async () => {
        try {
          await triggerWebhook(env, 'file.uploaded', {
            file: fileInfo,
            user: user,
          });
        } catch (e) {
          console.error('Webhook trigger failed:', e);
        }
      })()
    );

    return c.json({
      success: true,
      data: {
        id: fileId,
        name: fileName,
        url: `/file/${fileId}`,
        src: `/file/${fileId}`, // 兼容旧前端
      },
    });
  } catch (err) {
    console.error('Upload failed:', err);
    return c.json({ success: false, error: `${MSG.COMMON.UPLOAD_FAILED}: ${err.message}` }, 500);
  }
});

export default app;
