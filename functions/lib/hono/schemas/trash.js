import { z } from 'zod';

/** 还原回收站项目 */
export const RestoreSchema = z.object({
  fileIds: z.array(z.string()).optional().default([]),
  folderIds: z.array(z.string()).optional().default([]),
});

/** 彻底删除回收站项目 */
export const DeleteTrashSchema = z.object({
  fileIds: z.array(z.string()).optional().default([]),
  folderIds: z.array(z.string()).optional().default([]),
});
