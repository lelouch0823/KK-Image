import { z } from 'zod';
import { MSG } from '../../../_shared/utils.js';

/** 创建销售人员 */
export const CreateSalespersonSchema = z.object({
  name: z.string().min(1, MSG.SALESPERSON.NAME_REQUIRED).max(100),
  store: z.string().max(200).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  password: z.string().min(1, MSG.SALESPERSON.PASSWORD_REQUIRED).max(100),
});

/** 更新销售人员 */
export const UpdateSalespersonSchema = z.object({
  name: z.string().max(100).optional(),
  store: z.string().max(200).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  password: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});
