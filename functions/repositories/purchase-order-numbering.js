export function isPurchaseOrderNoConflictError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('unique constraint failed')
    && message.includes('purchase_orders.po_no');
}

export async function generatePurchaseOrderNo(db) {
  const now = new Date();
  const year = now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric' });
  const month = now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai', month: '2-digit' });
  const day = now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai', day: '2-digit' });
  const prefix = `PO-${year}${month}${day}`;

  const latest = await db
    .prepare(
      `SELECT po_no
       FROM purchase_orders
       WHERE po_no LIKE ?
       ORDER BY po_no DESC
       LIMIT 1`
    )
    .bind(`${prefix}-%`)
    .first();

  const seq = Number(String(latest?.po_no || '').split('-').at(-1) || 0) + 1;
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}
