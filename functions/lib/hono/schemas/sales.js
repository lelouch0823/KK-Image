import { z } from 'zod';

export const SalesLoginSchema = z.object({
    username: z.string().min(1, '请输入用户名'),
    password: z.string().min(1, '请输入密码'),
});

export const WechatLoginSchema = z.object({
    code: z.string().min(1, '缺少微信登录 code'),
});

export const BindWechatSchema = z.object({
    code: z.string().min(1, '缺少 code'),
});

export const CreateOrderSchema = z.object({
    name: z.string().min(1, '产品名称必填'),
    brand: z.string().optional().default(''),
    series: z.string().optional().default(''),
    sku: z.string().optional().default(''),
    size: z.string().optional().default(''),
    color: z.string().optional().default(''),
    material: z.string().optional().default(''),
    remark: z.string().optional().default(''),
    deadline: z.string().optional().default(''),
    quantity: z.number().min(1, '数量至少为1').optional().default(1),
    fileIds: z.array(z.string()).optional().default([]),
    productId: z.string().nullable().optional(),
});

export const AddCommentSchema = z.object({
    comment: z.string().min(1, '内容必填'),
});
