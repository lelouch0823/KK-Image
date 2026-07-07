// Re-export from canonical location — kept for backward compatibility
export {
  NUMERIC_FIELDS,
  PRODUCT_FIELDS,
  VALID_VARIANT_STATUSES,
  normalizeNumeric,
  normalizeStatus,
  normalizeCurrency,
  sanitizeOptionsValues,
  sanitizeMappedRow,
  formatFileSize,
  createPreprocessStats,
  createValidationReport,
  isMeaningfulRow,
} from '@/utils/import-validators';
