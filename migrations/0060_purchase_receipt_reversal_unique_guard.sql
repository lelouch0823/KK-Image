DELETE FROM purchase_receipt_reversals
WHERE id IN (
  SELECT duplicate.id
  FROM purchase_receipt_reversals duplicate
  JOIN purchase_receipt_reversals keeper
    ON keeper.original_receipt_id = duplicate.original_receipt_id
   AND (
     keeper.created_at < duplicate.created_at
     OR (keeper.created_at = duplicate.created_at AND keeper.id < duplicate.id)
   )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_receipt_reversals_original_receipt_unique
  ON purchase_receipt_reversals(original_receipt_id);
