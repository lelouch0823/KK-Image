import { BadRequestError, ConflictError } from '../../lib/hono/errors.js';
import { toNonNegativeInt } from '../../api/utils/number.js';
import { buildOrderLineProjectionStatement } from '../order-line-shared.js';

export function getRemainingLineQuantity(line) {
  return Math.max(
    toNonNegativeInt(line.ordered_qty) -
      toNonNegativeInt(line.cancelled_qty) -
      toNonNegativeInt(line.shipped_qty),
    0
  );
}

export function getReadyLineQuantity(line) {
  return Math.max(
    toNonNegativeInt(line.received_qty) -
      toNonNegativeInt(line.shipped_qty) -
      toNonNegativeInt(line.reserved_qty),
    0
  );
}

export function getAllocationRemaining(allocation = {}) {
  return Math.max(
    toNonNegativeInt(allocation.allocated_qty) - toNonNegativeInt(allocation.released_qty),
    0
  );
}

export const RETURN_REASON_CODES = Object.freeze([
  'customer_refused',
  'wrong_item',
  'damage',
  'quality_issue',
  'logistics_failure',
  'other',
]);

export function parseReturnReason(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!RETURN_REASON_CODES.includes(normalized)) {
    throw new BadRequestError('returns require a valid return reason code');
  }
  return normalized;
}

export function normalizeLedgerNote(value) {
  return String(value || '').trim();
}

export function buildGuardedLineProjectionStatement(db, line, nextLineState, timestamp) {
  return buildOrderLineProjectionStatement(
    db,
    {
      ...nextLineState,
      id: line.line_id,
      order_id: line.order_id,
    },
    {
      ...line,
      id: line.line_id,
      order_id: line.order_id,
    },
    timestamp,
    { guardProjectionState: true, guardActiveOrder: true }
  );
}

export function buildPreviousWriteAssertionStatement(db) {
  return db.prepare(
    "SELECT json_extract(CASE WHEN changes() = 1 THEN '{}' ELSE 'not-json' END, '$') AS guard_ok"
  );
}

export function isPreviousWriteAssertionError(error) {
  return String(error?.message || error)
    .toLowerCase()
    .includes('malformed json');
}

export async function runGuardedBatch(db, statements, conflictMessage) {
  try {
    return await db.batch(statements);
  } catch (error) {
    if (isPreviousWriteAssertionError(error)) {
      throw new ConflictError(conflictMessage);
    }
    throw error;
  }
}
