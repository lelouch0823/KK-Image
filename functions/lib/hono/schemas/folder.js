import { z } from 'zod';
import { MSG } from '../_shared/utils.js';

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
export const UpdateFolderSchema = CreateFolderSchema.partial();

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
