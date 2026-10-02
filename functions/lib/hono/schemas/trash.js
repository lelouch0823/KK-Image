import { z } from 'zod';

/** 回收站批量操作的单类条目上限（与 files 批量接口一致，同时避免超出 D1 绑定参数上限） */
const TRASH_BATCH_MAX_ITEMS = 100;

/** 还原回收站项目 */
export const RestoreSchema = z.object({
  fileIds: z.array(z.string()).max(TRASH_BATCH_MAX_ITEMS).optional().default([]),
  folderIds: z.array(z.string()).max(TRASH_BATCH_MAX_ITEMS).optional().default([]),
});

/** 彻底删除回收站项目 */
export const DeleteTrashSchema = z.object({
  fileIds: z.array(z.string()).max(TRASH_BATCH_MAX_ITEMS).optional().default([]),
  folderIds: z.array(z.string()).max(TRASH_BATCH_MAX_ITEMS).optional().default([]),
});
