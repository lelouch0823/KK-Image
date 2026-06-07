import { z } from 'zod';

export const SalesLoginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

/** 路径 Token 登录 Schema */
export const TokenAuthSchema = z.object({
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
  variantId: z.string().nullable().optional(),
  lines: z
    .unknown()
    .optional()
    .refine((value) => value === undefined, '销售端暂不支持多商品明细'),
});

export const AddCommentSchema = z.object({
  comment: z.string().min(1, '内容必填'),
});

/** 销售端修改订单请求体 */
export const UpdateSalesOrderSchema = z
  .object({
    reason: z.string().min(1).max(500),
    productId: z.string().nullable().optional(),
    variantId: z.string().nullable().optional(),
    fileIds: z.array(z.string()).max(50).optional(),
    updates: z
      .object({
        name: z.string().max(200).optional(),
        brand: z.string().max(100).optional(),
        category: z.string().max(100).optional(),
        series: z.string().max(100).optional(),
        sku: z.string().max(100).optional(),
        size: z.string().max(50).optional(),
        color: z.string().max(50).optional(),
        material: z.string().max(100).optional(),
        remark: z.string().max(1000).optional(),
        deadline: z.string().optional(),
        quantity: z.number().int().positive().max(99999).optional(),
        image: z.string().optional(),
        image_url: z.string().optional(),
        // 允许 lines 通过验证，由 handler 检查并返回自定义错误
        lines: z.any().optional(),
      })
      .optional(),
  })
  .strict();
