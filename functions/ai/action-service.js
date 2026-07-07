import { AIActionOrchestrator } from './action-orchestrator.js';
import { D1ActionSessionStore } from './action-session-store.js';
import { createActionSubmitters } from './action-submitters.js';
import { getActionAdapter } from './action-registry.js';
import { extractActionSlots } from './slot-extraction.js';
import {
  resolveSalespersonSlot,
  resolveOrderProductSlot,
  resolveOrderVariantSlot,
  resolvePurchaseOrderItemsSlot,
} from './slot-resolvers.js';
import { CustomerRepository } from '../repositories/CustomerRepository.js';
import { ProductRepository } from '../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { PurchaseOrderRepository } from '../repositories/PurchaseOrderRepository.js';
import { PurchaseOrderService } from '../services/PurchaseOrderService.js';
import { SalespersonRepository } from '../repositories/SalespersonRepository.js';
import { DomainOutboxPublisher } from '../services/DomainOutboxPublisher.js';
import { runOutboxPoller } from '../api/cron/outbox.js';
import { scheduleProductCacheInvalidation } from '../services/_shared/cache-invalidation.js';
import { evaluateActionPermission } from '../lib/authz/index.js';

function buildAIEventCommandId(prefix, sessionId) {
  const normalized = String(sessionId || '').trim();
  return normalized ? `${prefix}:${normalized}` : `${prefix}:${crypto.randomUUID()}`;
}

function isDuplicateOutboxIdempotencyError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('unique constraint failed') &&
    (message.includes('domain_outbox.idempotency_key') ||
      message.includes('idx_domain_outbox_idempotency_key'))
  );
}

export function detectExplicitConfirmation(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  return /^(确认|确定|提交|创建吧|就这样|可以创建了)$/.test(normalized);
}

export async function deriveContextActionSlots(context = {}, { productRepo, variantRepo }) {
  const selectedId = String(context?.selectedId || '').trim();
  const selectedType = String(context?.selectedType || '').trim();
  if (!selectedId || !selectedType) return {};

  if (selectedType === 'variant' && variantRepo?.findById) {
    const variant = await variantRepo.findById(selectedId);
    if (!variant) return {};
    const product =
      variant.product_id && productRepo?.findById
        ? await productRepo.findById(variant.product_id)
        : null;
    return {
      productId: variant.product_id || null,
      variantId: variant.id || selectedId,
      productName: product?.name || '',
    };
  }

  if (selectedType === 'product' && productRepo?.findById) {
    const product = await productRepo.findById(selectedId);
    if (!product) return {};
    return {
      productId: product.id,
      productName: product.name || '',
    };
  }

  return {};
}

export async function publishPurchaseOrderCreatedFromAI(
  { c, env } = {},
  { created, mode, orderIds = [], items = [], sessionId = null } = {}
) {
  if (!env?.DB || !created?.id) return;

  const eventType =
    mode === 'from_orders' ? 'purchase_order_created_from_orders' : 'purchase_order_created';
  const payload =
    mode === 'from_orders'
      ? { order_ids: Array.isArray(orderIds) ? orderIds : [] }
      : { item_count: Array.isArray(items) ? items.length : 0 };

  const publisher = new DomainOutboxPublisher(env.DB);
  try {
    await publisher.publish(
      [
        {
          event_type: eventType,
          aggregate_type: 'purchase_order',
          aggregate_id: created.id,
          payload: {
            purchase_order_id: created.id,
            ...payload,
          },
        },
      ],
      {
        commandId: buildAIEventCommandId('ai_purchase_order', sessionId),
        correlationId: buildAIEventCommandId('ai_purchase_order', sessionId),
      }
    );
  } catch (error) {
    if (!isDuplicateOutboxIdempotencyError(error)) {
      throw error;
    }
  }

  c?.executionCtx?.waitUntil?.(
    runOutboxPoller({
      env,
      requestUrl: c?.req?.url || 'ai://action',
      workerId: `${eventType}:${created.id}:ai`,
    })
  );
}

export async function publishProductCreatedFromAI(
  { c, env } = {},
  { created, sessionId = null } = {}
) {
  if (!env?.DB || !created?.id) return;

  try {
    await scheduleProductCacheInvalidation(
      c,
      {
        eventType: 'product_created',
        productIds: [created.id],
      },
      {
        commandId: buildAIEventCommandId('ai_product', sessionId),
        correlationId: buildAIEventCommandId('ai_product', sessionId),
      }
    );
  } catch (error) {
    if (!isDuplicateOutboxIdempotencyError(error)) {
      throw error;
    }
  }
}

export async function publishOrderCreatedFromAI(
  { c, env, user } = {},
  { created, salespersonId = null, sessionId = null } = {}
) {
  if (!env?.DB || !created?.id) return;

  const publisher = new DomainOutboxPublisher(env.DB);
  try {
    await publisher.publish(
      [
        {
          event_type: 'order_created_by_admin',
          aggregate_type: 'order',
          aggregate_id: created.id,
          payload: {
            order_id: created.id,
            order_no: created.orderNo || null,
            salesperson_id: salespersonId,
            actor_name: user?.name || user?.id || 'AI',
          },
        },
      ],
      {
        commandId: buildAIEventCommandId('ai_order', sessionId),
        correlationId: buildAIEventCommandId('ai_order', sessionId),
      }
    );
  } catch (error) {
    if (!isDuplicateOutboxIdempotencyError(error)) {
      throw error;
    }
  }

  c?.executionCtx?.waitUntil?.(
    runOutboxPoller({
      env,
      requestUrl: c?.req?.url || 'ai://action',
      workerId: `order_created_by_admin:${created.id}:ai`,
    })
  );
}

export function createActionOrchestrator({
  c,
  env,
  user,
  createManagedOrder,
  createManagedProduct,
}) {
  const customerRepo = new CustomerRepository(env.DB);
  const productRepo = new ProductRepository(env.DB);
  const variantRepo = new ProductVariantRepository(env.DB);
  const purchaseOrderRepo = new PurchaseOrderRepository(env.DB);
  const purchaseOrderService = new PurchaseOrderService(env.DB);
  const salespersonRepo = new SalespersonRepository(env.DB, env.JWT_SECRET);

  return new AIActionOrchestrator({
    sessionStore: new D1ActionSessionStore(env.DB),
    getActionAdapter,
    submitters: createActionSubmitters({
      customerRepo: {
        create: (payload) =>
          customerRepo.create({
            ...payload,
            createdBy: user?.name || user?.id || 'AI',
          }),
      },
      purchaseOrderRepo,
      purchaseOrderService,
      salespersonRepo,
      orderService: {
        create: (payload) =>
          createManagedOrder(c, payload, user, {
            skipOrderCreatedEvent: true,
          }),
      },
      productService: {
        create: (payload) =>
          createManagedProduct(c, payload, {
            skipCacheInvalidation: true,
          }),
      },
    }),
    slotResolvers: {
      order: {
        salespersonId: async (rawValue, slots) =>
          resolveSalespersonSlot(rawValue, slots, { salespersonRepo }),
        productId: async (rawValue, slots) =>
          resolveOrderProductSlot(rawValue, slots, { productRepo }),
        variantId: async (rawValue, slots) =>
          resolveOrderVariantSlot(rawValue, slots, { variantRepo }),
      },
      purchase_order: {
        items: async (items) => resolvePurchaseOrderItemsSlot(items, { variantRepo }),
      },
    },
    extractActionSlots,
    canAccessAction: async (subject, adapter) => {
      if (!adapter?.requiredPermission) return false;
      return evaluateActionPermission({
        user: subject,
        permission: adapter.requiredPermission,
      });
    },
  });
}

export function createAIActionService(deps = {}) {
  const deriveSlots = deps.deriveContextActionSlots || deriveContextActionSlots;
  const detectConfirmation = deps.detectExplicitConfirmation || detectExplicitConfirmation;
  const createOrchestrator = deps.createActionOrchestrator || createActionOrchestrator;
  const publishPurchaseOrderCreated =
    deps.publishPurchaseOrderCreated || publishPurchaseOrderCreatedFromAI;
  const publishProductCreated = deps.publishProductCreated || publishProductCreatedFromAI;
  const publishOrderCreated = deps.publishOrderCreated || publishOrderCreatedFromAI;
  const createSessionStore =
    deps.createSessionStore ||
    ((actionContext = {}) =>
      actionContext?.env?.DB ? new D1ActionSessionStore(actionContext.env.DB) : null);

  return {
    async handleTurn({ text = '', context = {}, user = null, actionContext = null } = {}) {
      const contextSlots = await deriveSlots(context, actionContext?.repos || {});
      const orchestrator = createOrchestrator(actionContext || {});
      const actionResult = await orchestrator.advance({
        userId: user?.id || 'anonymous',
        user,
        text,
        slots: contextSlots,
        confirmation: detectConfirmation(text),
      });

      if (!actionResult) {
        return {
          handled: false,
          actionResult: null,
          event: null,
          refreshEvent: null,
        };
      }

      if (actionResult.kind === 'action_denied') {
        return {
          handled: true,
          actionResult: {
            kind: 'action_denied',
            payload: {
              ...actionResult.payload,
              successMessage: '当前账号没有执行该 AI 写操作的权限。',
            },
          },
          event: null,
          refreshEvent: null,
        };
      }

      if (
        actionResult.kind === 'action_submitted' &&
        actionResult.payload?.entityType === 'purchase_order' &&
        actionResult.payload?.purchaseOrderCreated
      ) {
        await publishPurchaseOrderCreated(actionContext || {}, {
          ...actionResult.payload.purchaseOrderCreated,
          sessionId: actionResult.payload.sessionId || null,
        });
        const sessionStore = createSessionStore(actionContext || {});
        if (actionResult.payload?.sessionId && sessionStore?.updateSession) {
          await sessionStore.updateSession(actionResult.payload.sessionId, {
            status: 'completed',
          });
        }
      }

      if (
        actionResult.kind === 'action_submitted' &&
        actionResult.payload?.entityType === 'product' &&
        actionResult.payload?.productCreated
      ) {
        await publishProductCreated(actionContext || {}, {
          ...actionResult.payload.productCreated,
          sessionId: actionResult.payload.sessionId || null,
        });
        const sessionStore = createSessionStore(actionContext || {});
        if (actionResult.payload?.sessionId && sessionStore?.updateSession) {
          await sessionStore.updateSession(actionResult.payload.sessionId, {
            status: 'completed',
          });
        }
      }

      if (
        actionResult.kind === 'action_submitted' &&
        actionResult.payload?.entityType === 'order' &&
        actionResult.payload?.orderCreated
      ) {
        await publishOrderCreated(
          {
            ...(actionContext || {}),
            user,
          },
          {
            ...actionResult.payload.orderCreated,
            sessionId: actionResult.payload.sessionId || null,
          }
        );
        const sessionStore = createSessionStore(actionContext || {});
        if (actionResult.payload?.sessionId && sessionStore?.updateSession) {
          await sessionStore.updateSession(actionResult.payload.sessionId, {
            status: 'completed',
          });
        }
      }

      const refreshEvent =
        actionResult.kind === 'action_submitted' && actionResult.payload?.targetModule
          ? {
              type: 'module_refresh',
              data: {
                module: actionResult.payload.targetModule,
                reason: 'ai_created',
                entityId: actionResult.payload.createdEntityId || null,
                timestamp: Date.now(),
                silent: true,
              },
            }
          : null;

      return {
        handled: true,
        actionResult,
        event: {
          type: actionResult.kind,
          data: actionResult.payload || {},
        },
        refreshEvent,
      };
    },
  };
}
