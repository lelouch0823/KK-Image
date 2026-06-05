import { z } from 'zod';
import { MSG } from '../../../_shared/utils.js';

/** 创建客户 */
export const CreateCustomerSchema = z.object({
    name: z.string().min(1, MSG.COMMON.REQUIRED).max(100),
    phone: z.string().max(30).optional().default(''),
    company: z.string().max(200).optional().default(''),
    email: z.string().email().max(200).optional().or(z.literal('')).default(''),
    address: z.string().max(500).optional().default(''),
    tags: z.array(z.string()).optional().default([]),
    remark: z.string().max(2000).optional().default(''),
});

/** 更新客户 */
export const UpdateCustomerSchema = CreateCustomerSchema.partial();

/** 批量添加标签 */
export const BatchTagsSchema = z.object({
    ids: z.array(z.string()).min(1).max(500),
    tag: z.string().min(1).max(100),
}).strict();

/** 批量导出客户 */
export const BatchExportSchema = z.object({
    ids: z.array(z.string()).min(1).max(10000),
}).strict();

/** 添加单个标签 */
export const AddTagSchema = z.object({
    tag: z.string().min(1, '请输入标签名称').max(100),
}).strict();

/** 导入客户确认 */
export const ImportConfirmSchema = z.object({
    rows: z.array(z.object({
        name: z.string().min(1).max(100),
        phone: z.string().max(30).optional().default(''),
        company: z.string().max(200).optional().default(''),
        email: z.string().max(200).optional().default(''),
        address: z.string().max(500).optional().default(''),
        tags: z.array(z.string()).optional().default([]),
        remark: z.string().max(2000).optional().default(''),
    })).min(1, '请提供至少一条客户数据'),
});

/** 沟通类型枚举 */
export const COMMUNICATION_TYPES = ['note', 'call', 'email', 'meeting', 'wechat'];

/** 添加沟通记录 */
export const CreateCommunicationSchema = z.object({
    type: z.enum(COMMUNICATION_TYPES).default('note'),
    content: z.string().min(1, '沟通内容不能为空'),
});
