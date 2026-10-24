import { generateId } from '../api/utils/id.js';
import { executeBatchChunks } from '../lib/db/batch.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { BadRequestError } from '../lib/hono/errors.js';
import {
  appendInventoryLedgerEvent,
  projectInventoryBalances,
} from './InventoryProjectionService.js';
import { ProductProjectionRefreshService } from './ProductProjectionRefreshService.js';
import { queryOrderLineCandidates, resolveOrderLineId } from './order-line-shared.js';
import {
  buildBalanceDeltaUpsertStatement,
  buildChangesAssertionStatement,
  buildVariantStockDeltaStatement,
  normalizeInventoryWriteError,
} from './_shared/inventory-write-statements.js';

const VALID_MUTATION_TYPES = new Set([
  'purchase_received',
  'purchase_arrival',
  'inventory_adjusted_reversal',
  'manual_adjustment',
  'order_shipment',
  'order_unshipment',
  'order_return_restock',
  'order_return_cancelled',
]);
export { appendInventoryLedgerEvent, projectInventoryBalances };

export class InventoryService {
  constructor(db, variantRepo = new ProductVariantRepository(db), deps = {}) {
    this.db = db;
    this.variantRepo = variantRepo;
    this.productProjectionRefreshService =
      deps.productProjectionRefreshService || new ProductProjectionRefreshService(db);
  }

  async queryOrderLineCandidates(payload = {}, includeScopedFilters = true) {
    return queryOrderLineCandidates(this.db, payload, includeScopedFilters);
  }

  async resolveOrderLineId(payload = {}) {
    return resolveOrderLineId(this.db, payload);
  }

  async getOnHand(variantId) {
    if (!variantId) return 0;
    const variant =
      typeof this.variantRepo.findById === 'function'
        ? await this.variantRepo.findById(variantId)
        : null;
    return Math.max(0, Number(variant?.stock_quantity) || 0);
  }

  async assertSufficient(variantId, requiredQty) {
    const safeRequiredQty = Math.max(0, Number(requiredQty) || 0);
    if (!variantId || safeRequiredQty <= 0) return true;

    const onHand = await this.getOnHand(variantId);
    if (onHand < safeRequiredQty) {
      throw new Error('insufficient variant stock for delivery');
    }
    return true;
  }

  validateMutation(payload = {}) {
    const type = String(payload.type || '').trim();
    const variantId = String(payload.variantId || '').trim();
    const quantityDelta = Number(payload.quantityDelta);

    if (!VALID_MUTATION_TYPES.has(type)) {
      throw new BadRequestError('Invalid inventory mutation type');
    }
    if (!variantId) {
      throw new BadRequestError('variantId is required');
    }
    if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
      throw new BadRequestError('quantityDelta must be a non-zero number');
    }

    return { type, variantId, quantityDelta };
  }

  async buildMutationStatements(payload = {}) {
    const mutation = this.validateMutation(payload);
    const timestamp = Date.now();
    const orderLineId = await this.resolveOrderLineId(payload);
    const purchaseReceiptId = payload.purchaseReceiptId || null;
    const sourceType = payload.referenceType || 'inventory_service';
    const sourceId = payload.referenceId || mutation.variantId;
    const ledgerId = generateId();
    const inventoryEventId = generateId();

    const stockDeltaStatement = buildVariantStockDeltaStatement(this.db, {
      variantId: mutation.variantId,
      quantityDelta: mutation.quantityDelta,
      timestamp,
    });

    return {
      mutation,
      orderLineId,
      purchaseReceiptId,
      sourceType,
      sourceId,
      ledgerId,
      inventoryEventId,
      timestamp,
      statements: [
        // 负增量带下限守卫；紧随 changes() 断言：谓词不满足时 UPDATE 命中
        // 0 行，没有断言的话 batch 会静默通过，product_variants.stock_quantity
        // 与 inventory_balances.on_hand 在两表基线漂移时永久背离（审查 B12）
        stockDeltaStatement.statement,
        ...(stockDeltaStatement.guarded ? [buildChangesAssertionStatement(this.db)] : []),
        // 余额相对增量，越限由 0099 CHECK 约束拒绝；available 恒等重算
        buildBalanceDeltaUpsertStatement(this.db, {
          variantId: mutation.variantId,
          onHandDelta: mutation.quantityDelta,
          reservedDelta: 0,
          timestamp,
        }),
        this.db
          .prepare(
            `INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            ledgerId,
            mutation.variantId,
            mutation.type,
            mutation.quantityDelta,
            sourceType,
            sourceId,
            timestamp,
            JSON.stringify(payload.metadata || {}),
            timestamp
          ),
        this.db
          .prepare(
            `INSERT INTO inventory_events (
            id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta,
            source_type, source_id, metadata, occurred_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            inventoryEventId,
            mutation.variantId,
            orderLineId,
            purchaseReceiptId,
            mutation.type,
            mutation.quantityDelta,
            sourceType,
            sourceId,
            JSON.stringify(payload.metadata || {}),
            timestamp,
            timestamp
          ),
      ],
    };
  }

  async applyMutation(payload = {}) {
    const mutation = this.validateMutation(payload);
    if (typeof this.db?.prepare === 'function') {
      const { statements } = await this.buildMutationStatements(payload);
      try {
        await this.db.batch(statements);
      } catch (error) {
        // 余额越限（0099 CHECK）→ 409；负的 variant 增量由 WHERE 下限守卫拦截
        throw normalizeInventoryWriteError(error, '库存不足，操作已回滚');
      }
      await this.productProjectionRefreshService.refreshByVariantIds([mutation.variantId]);
    } else if (typeof this.variantRepo?.adjustStock === 'function') {
      await this.variantRepo.adjustStock(mutation.variantId, mutation.quantityDelta);
    } else {
      throw new Error(
        'InventoryService requires a DB handle or variant repository adjustStock implementation'
      );
    }
    return mutation;
  }

  /**
   * 刷新变体的商品投影。供绕过 applyBatch、自行按块执行语句的调用方
   * （如盘点调整的项级幂等路径）在全部块提交后统一刷新。
   */
  async refreshProjections(variantIds = []) {
    const ids = [...new Set((variantIds || []).filter(Boolean))];
    if (ids.length === 0) return;
    await this.productProjectionRefreshService.refreshByVariantIds(ids);
  }

  async applyBatch(mutations = []) {
    if (!Array.isArray(mutations) || mutations.length === 0) {
      return { productCount: 0, totalQty: 0 };
    }

    if (typeof this.db?.prepare === 'function' && typeof this.db?.batch === 'function') {
      const statements = [];
      for (const mutation of mutations) {
        const built = await this.buildMutationStatements(mutation);
        statements.push(...built.statements);
      }
      try {
        await executeBatchChunks(this.db, statements);
      } catch (error) {
        throw normalizeInventoryWriteError(error, '库存不足，操作已回滚');
      }
      await this.productProjectionRefreshService.refreshByVariantIds(
        mutations.map((mutation) => mutation?.variantId)
      );
    } else {
      for (const mutation of mutations) {
        await this.applyMutation(mutation);
      }
    }

    return {
      productCount: mutations.length,
      totalQty: mutations.reduce(
        (sum, mutation) => sum + Math.abs(Number(mutation.quantityDelta) || 0),
        0
      ),
    };
  }
}
