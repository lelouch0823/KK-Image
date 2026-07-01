import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ProductRepository } from '../../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../../repositories/ProductVariantRepository.js';
import { PriceRuleRepository } from '../../../../../../repositories/PriceRuleRepository.js';
import { scheduleAuditEvent } from '../../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../../_shared/audit-route-contract.js';
import { NotFoundError } from '../../../../errors.js';
import { UpsertPriceRulesSchema } from '../../../../schemas/product.js';

const app = new Hono();

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/:id/prices',
    domain: 'products',
    action: 'product.price_rules.upsert',
    severity: 'high',
    targetType: 'product',
  },
  {
    method: 'DELETE',
    path: '/:id/prices/:ruleId',
    domain: 'products',
    action: 'product.price_rules.delete',
    severity: 'high',
    targetType: 'product',
  },
]);

const ensureProductExists = async (productRepo, productId) => {
  const product = await productRepo.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }
  return product;
};

/**
 * GET /:id/prices - 获取商品所有变体的价格规则
 */
app.get('/:id/prices', async (c) => {
  const { env } = c;
  const productId = c.req.param('id');
  const productRepo = new ProductRepository(env.DB);
  await ensureProductExists(productRepo, productId);

  const priceRuleRepo = new PriceRuleRepository(env.DB);
  const priceRulesMap = await priceRuleRepo.findByProductId(productId);

  // 转换 Map 为普通对象
  const data = {};
  for (const [variantId, rules] of priceRulesMap) {
    data[variantId] = rules;
  }

  return c.json({ success: true, data });
});

/**
 * POST /:id/prices - 批量创建/更新价格规则
 */
app.post('/:id/prices', zValidator('json', UpsertPriceRulesSchema), async (c) => {
  const { env } = c;
  const productId = c.req.param('id');
  const body = c.req.valid('json');

  const productRepo = new ProductRepository(env.DB);
  const product = await ensureProductExists(productRepo, productId);

  const variantRepo = new ProductVariantRepository(env.DB);
  const priceRuleRepo = new PriceRuleRepository(env.DB);

  // 验证所有 variantId 属于该商品
  for (const rule of body.rules) {
    await variantRepo.assertBelongsToProduct(rule.variantId, productId);
  }

  const results = await priceRuleRepo.upsertBatch(body.rules);

  scheduleAuditEvent(c, {
    domain: 'products',
    action: 'product.price_rules.upsert',
    result: 'success',
    severity: 'high',
    targetType: 'product',
    targetId: productId,
    target_label: product.name || productId,
    summary: `Updated ${results.length} price rules on product ${productId}`,
    metadata: {
      ruleCount: results.length,
      priceTypes: [...new Set(results.map((r) => r.price_type))],
    },
  });

  return c.json({ success: true, data: results });
});

/**
 * DELETE /:id/prices/:ruleId - 删除价格规则
 */
app.delete('/:id/prices/:ruleId', async (c) => {
  const { env } = c;
  const productId = c.req.param('id');
  const ruleId = c.req.param('ruleId');

  const productRepo = new ProductRepository(env.DB);
  const product = await ensureProductExists(productRepo, productId);

  const priceRuleRepo = new PriceRuleRepository(env.DB);
  const deleted = await priceRuleRepo.delete(ruleId);

  if (!deleted) {
    throw new NotFoundError('Price rule not found');
  }

  scheduleAuditEvent(c, {
    domain: 'products',
    action: 'product.price_rules.delete',
    result: 'success',
    severity: 'high',
    targetType: 'product',
    targetId: productId,
    target_label: product.name || productId,
    summary: `Deleted price rule ${ruleId} from product ${productId}`,
  });

  return c.json({ success: true });
});

export default app;
