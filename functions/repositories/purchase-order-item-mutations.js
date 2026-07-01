import { hasChanges } from '../api/utils/result.js';
import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';
import { hydratePurchaseItemSnapshots } from './purchase-order-item-snapshots.js';
import { D1_MAX_IN_CLAUSE_SIZE } from '../api/utils/constants.js';

export async function addPurchaseOrderItems({ db, poId, items }) {
  if (!items || items.length === 0) return [];

  const now = Date.now();
  const statements = [];
  const createdIds = [];
  const hydratedItems = await hydratePurchaseItemSnapshots({ db, items });

  for (const item of hydratedItems) {
    if (!item.product_id) {
      throw new Error('product_id is required');
    }
    if (!item.variant_id) {
      throw new Error('variant_id is required');
    }
    const id = crypto.randomUUID();
    createdIds.push(id);

    statements.push(
      db
        .prepare(
          `
        INSERT INTO purchase_order_items (
          id, po_id, product_id, variant_id, pre_order_id, order_line_id, quantity, unit_cost, snapshot_name, snapshot_sku, snapshot_specs, snapshot_image, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          id,
          poId,
          item.product_id,
          item.variant_id,
          item.pre_order_id || null,
          item.order_line_id || null,
          item.quantity || 1,
          item.unit_cost || 0,
          item.snapshot_name || null,
          item.snapshot_sku || null,
          item.snapshot_specs || null,
          item.snapshot_image || null,
          now
        )
    );
  }

  let insertedCount = 0;
  try {
    for (const chunk of chunkArray(statements, D1_MAX_IN_CLAUSE_SIZE)) {
      await executeBatchChunks(db, chunk);
      insertedCount += chunk.length;
    }
  } catch (error) {
    const insertedIds = createdIds.slice(0, insertedCount);
    if (insertedIds.length > 0) {
      for (const idChunk of chunkArray(insertedIds, D1_MAX_IN_CLAUSE_SIZE)) {
        const placeholders = idChunk.map(() => '?').join(',');
        await db
          .prepare(`DELETE FROM purchase_order_items WHERE id IN (${placeholders})`)
          .bind(...idChunk)
          .run();
      }
    }
    throw error;
  }

  try {
    await db
      .prepare(`UPDATE purchase_orders SET updated_at = ? WHERE id = ?`)
      .bind(now, poId)
      .run();
  } catch (error) {
    if (createdIds.length > 0) {
      for (const idChunk of chunkArray(createdIds, D1_MAX_IN_CLAUSE_SIZE)) {
        const placeholders = idChunk.map(() => '?').join(',');
        await db
          .prepare(`DELETE FROM purchase_order_items WHERE id IN (${placeholders})`)
          .bind(...idChunk)
          .run();
      }
    }
    throw error;
  }

  return createdIds;
}

export async function removePurchaseOrderItem({ db, poIdOrItemId, itemIdMaybe }) {
  const useScopedDelete = typeof itemIdMaybe === 'string';
  const sql = useScopedDelete
    ? `DELETE FROM purchase_order_items WHERE id = ? AND po_id = ?`
    : `DELETE FROM purchase_order_items WHERE id = ?`;
  const params = useScopedDelete ? [itemIdMaybe, poIdOrItemId] : [poIdOrItemId];

  const statements = useScopedDelete
    ? [
        db.prepare(sql).bind(...params),
        db
          .prepare(`UPDATE purchase_orders SET updated_at = ? WHERE id = ?`)
          .bind(Date.now(), poIdOrItemId),
      ]
    : [db.prepare(sql).bind(...params)];
  const [result] = useScopedDelete
    ? await executeBatchChunks(db, statements)
    : [await statements[0].run()];
  return hasChanges(result);
}

export async function updatePurchaseOrderItem({ db, poIdOrItemId, itemIdOrUpdates, updatesMaybe }) {
  const scoped = updatesMaybe !== undefined;
  const poId = scoped ? poIdOrItemId : null;
  const itemId = scoped ? itemIdOrUpdates : poIdOrItemId;
  const updates = scoped ? updatesMaybe : itemIdOrUpdates;

  const fields = [];
  const values = [];

  if (updates.quantity !== undefined) {
    fields.push('quantity = ?');
    values.push(updates.quantity);
  }
  if (updates.unit_cost !== undefined) {
    fields.push('unit_cost = ?');
    values.push(updates.unit_cost);
  }

  if (fields.length === 0) return false;

  const where = scoped ? 'WHERE id = ? AND po_id = ?' : 'WHERE id = ?';
  if (scoped) {
    values.push(itemId, poId);
  } else {
    values.push(itemId);
  }
  const statements = scoped
    ? [
        db.prepare(`UPDATE purchase_order_items SET ${fields.join(', ')} ${where}`).bind(...values),
        db.prepare(`UPDATE purchase_orders SET updated_at = ? WHERE id = ?`).bind(Date.now(), poId),
      ]
    : [db.prepare(`UPDATE purchase_order_items SET ${fields.join(', ')} ${where}`).bind(...values)];
  const [result] = scoped ? await executeBatchChunks(db, statements) : [await statements[0].run()];

  return hasChanges(result);
}
