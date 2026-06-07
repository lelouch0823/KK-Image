import { z } from 'zod';
import { MSG } from '../../../_shared/utils.js';

/**
 * 文件创建 Schema
 */
export const CreateFileSchema = z.object({
  name: z.string().min(1, MSG.FILE.NAME_REQUIRED).max(255, MSG.FILE.NAME_TOO_LONG),
  folderId: z.string().optional().nullable(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(10).optional(),
  description: z.string().max(500).optional(),
});

export const UpdateFileSchema = CreateFileSchema.partial();

export const FileQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['created_at', 'name', 'size', 'updated_at']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  folderId: z.string().optional(),
  search: z.string().max(100).optional(),
  type: z.enum(['image', 'video', 'document', 'other', 'all']).default('all'),
  isPublic: z.coerce.boolean().optional(),
});

export const BatchFileSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  action: z.enum(['delete', 'move', 'copy', 'updateVisibility']).optional(),
});

export const MoveFileSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  targetFolderId: z.string().nullable(),
});

export const DeleteFilesSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

export const MoveFilesSchema = MoveFileSchema;

export const RenameFileSchema = z.object({
  name: z.string().min(1).max(255),
});

/** 文件预检查（秒传） */
export const CheckHashSchema = z
  .object({
    original_hash: z.string().min(1, 'original_hash 不能为空').max(255),
  })
  .strict();
