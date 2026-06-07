function normalizeSummaryValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function deriveOrderSummaryFields(data = {}) {
  return {
    summaryName: normalizeSummaryValue(data?.name),
    summaryBrand: normalizeSummaryValue(data?.brand),
    summarySku: normalizeSummaryValue(data?.sku || data?.variant_sku || data?.spu),
  };
}

export function createOrderPayloadUpsertStatement(
  db,
  { orderId, originalData, currentData, createdAt, updatedAt }
) {
  const safeOriginalData =
    typeof originalData === 'string' ? originalData : JSON.stringify(originalData || {});
  const safeCurrentData =
    typeof currentData === 'string' ? currentData : JSON.stringify(currentData || {});
  const safeCreatedAt = Number(createdAt || updatedAt || Date.now());
  const safeUpdatedAt = Number(updatedAt || createdAt || Date.now());

  return db
    .prepare(
      `
        INSERT INTO order_payloads (order_id, original_data, current_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(order_id) DO UPDATE SET
            original_data = COALESCE(order_payloads.original_data, excluded.original_data),
            current_data = excluded.current_data,
            updated_at = excluded.updated_at
        `
    )
    .bind(orderId, safeOriginalData, safeCurrentData, safeCreatedAt, safeUpdatedAt);
}

export const ORDER_PAYLOADS_JOIN_SQL = `
      LEFT JOIN order_payloads op ON op.order_id = o.id
`;

export const ORDER_PAYLOADS_SELECT_SQL = `
      COALESCE(op.original_data, o.original_data) as original_data,
      COALESCE(op.current_data, o.current_data) as current_data
`;
