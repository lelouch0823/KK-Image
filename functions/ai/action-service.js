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
    const product = variant.product_id && productRepo?.findById
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

export function createActionOrchestrator({ c, env, user, createManagedOrder, createManagedProduct }) {
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
        create: (payload) => customerRepo.create({
          ...payload,
          createdBy: user?.name || user?.id || 'AI',
        }),
      },
      purchaseOrderRepo,
      purchaseOrderService,
      salespersonRepo,
      orderService: {
        create: (payload) => createManagedOrder(c, payload, user),
      },
      productService: {
        create: (payload) => createManagedProduct(c, payload),
      },
    }),
    slotResolvers: {
      order: {
        salespersonId: async (rawValue, slots) => resolveSalespersonSlot(rawValue, slots, { salespersonRepo }),
        productId: async (rawValue, slots) => resolveOrderProductSlot(rawValue, slots, { productRepo }),
        variantId: async (rawValue, slots) => resolveOrderVariantSlot(rawValue, slots, { variantRepo }),
      },
      purchase_order: {
        items: async (items) => resolvePurchaseOrderItemsSlot(items, { variantRepo }),
      },
    },
    extractActionSlots,
  });
}

export function createAIActionService(deps = {}) {
  const deriveSlots = deps.deriveContextActionSlots || deriveContextActionSlots;
  const detectConfirmation = deps.detectExplicitConfirmation || detectExplicitConfirmation;
  const createOrchestrator = deps.createActionOrchestrator || createActionOrchestrator;

  return {
    async handleTurn({ text = '', context = {}, user = null, actionContext = null } = {}) {
      const contextSlots = await deriveSlots(context, actionContext?.repos || {});
      const orchestrator = createOrchestrator(actionContext || {});
      const actionResult = await orchestrator.advance({
        userId: user?.id || 'anonymous',
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

      const refreshEvent = actionResult.kind === 'action_submitted' && actionResult.payload?.targetModule
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
