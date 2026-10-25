import { z } from 'zod';
import { MSG } from '../../../_shared/utils.js';

/**
 * 文件夹创建 Schema
 */
export const CreateFolderSchema = z.object({
  name: z.string().min(1, MSG.FOLDER.NAME_REQUIRED).max(100, MSG.FOLDER.NAME_TOO_LONG),
  parentId: z.string().optional().nullable(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
  password: z.string().min(4).max(50).optional().nullable(),
});

/**
 * 文件夹更新 Schema
 */
export const UpdateFolderSchema = CreateFolderSchema.partial().extend({
  shareExpiresAt: z.number().optional().nullable(),
  // C-R5（F-7）：仅接受 null（撤销分享时清除令牌）——下次重新开启分享会生成
  // 新令牌，旧链接持有者无法凭旧 URL 恢复访问；非 null 值拒绝（令牌不可自定义）
  shareToken: z
    .literal(null, { errorMap: () => ({ message: '分享令牌不可自定义，只能撤销（null）' }) })
    .optional(),
});

/**
 * 文件夹查询参数 Schema
 */
export const FolderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  parentId: z.string().optional().nullable(),
  search: z.string().max(100).optional(),
  includeFiles: z.coerce.boolean().default(false),
  recursive: z.coerce.boolean().default(false),
});

/**
 * 分享设置 Schema
 */
export const ShareSettingsSchema = z.object({
  isPublic: z.boolean(),
  password: z.string().min(4).max(50).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});
