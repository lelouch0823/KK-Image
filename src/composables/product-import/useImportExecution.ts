import { ref, computed } from 'vue';
import { hasEntries } from '@/utils/object-utils';
import { PRODUCT_FIELDS } from '@/utils/import-validators';

const CHUNK_SIZE = 200;

export function useImportExecution({ t, addToast, parsedItems, importMode, workflow, emit }) {
  const loading = ref(false);
  const importError = ref(null);
  const importResult = ref(null);

  const _importStats = ref({
    processed: 0,
    total: 0,
    success: 0,
    failed: 0,
    errors: [],
    conflicts: [],
    createdProducts: 0,
    updatedProducts: 0,
    createdVariants: 0,
    updatedVariants: 0,
    conflictCount: 0,
  });

  const importStats = computed(() => _importStats.value);

  const resetExecution = () => {
    loading.value = false;
    importError.value = null;
    importResult.value = null;
    _importStats.value = {
      processed: 0,
      total: 0,
      success: 0,
      failed: 0,
      errors: [],
      conflicts: [],
      createdProducts: 0,
      updatedProducts: 0,
      createdVariants: 0,
      updatedVariants: 0,
      conflictCount: 0,
    };
  };

  // --- Grouping helpers ---
  const buildGroupKey = (row, idx) => {
    const spu = String(row.spu || '').trim();
    return spu ? `spu:${spu}` : `row:${idx}`;
  };

  const buildDimensionsFromRows = (rows) => {
    const dimensionMap = new Map();
    rows.forEach((row) => {
      Object.entries(row?.options_values || {}).forEach(([name, value]) => {
        const cleanName = String(name || '').trim();
        const cleanValue = String(value || '').trim();
        if (!cleanName || !cleanValue) return;
        if (!dimensionMap.has(cleanName)) {
          dimensionMap.set(cleanName, []);
        }
        const values = dimensionMap.get(cleanName);
        if (!values.includes(cleanValue)) {
          values.push(cleanValue);
        }
      });
    });
    return Array.from(dimensionMap.entries()).map(([name, values]) => ({ name, values }));
  };

  const normalizeVariantFromRow = (row) => {
    const variant = { ...row };
    PRODUCT_FIELDS.forEach((key) => {
      delete variant[key];
    });
    if (
      variant.image_url &&
      typeof variant.image_url === 'string' &&
      !variant.image_url.match(/^https?:\/\//i)
    ) {
      delete variant.image_url;
    }
    return variant;
  };

  const groupRowsToProductPayload = (rows) => {
    const groups = new Map();
    rows.forEach((row, idx) => {
      const key = buildGroupKey(row, idx);
      if (!groups.has(key)) {
        const groupedRows = rows.filter(
          (candidate, candidateIndex) => buildGroupKey(candidate, candidateIndex) === key
        );
        groups.set(key, {
          name: row.name,
          spu: String(row.spu || '').trim() || undefined,
          currency: row.currency,
          category: row.category,
          brand: row.brand,
          series: row.series,
          description: row.description,
          dimensions: buildDimensionsFromRows(groupedRows),
          variants: [],
        });
      }
      const product = groups.get(key);
      product.variants.push(normalizeVariantFromRow(row));
    });
    return Array.from(groups.values());
  };

  // --- Import execution ---
  const handleImport = async ({ importProducts }) => {
    if (!parsedItems.value.length) return;
    const requestId = workflow.getImportRequestId();

    loading.value = true;
    importError.value = null;
    importResult.value = null;

    // Reset stats
    _importStats.value = {
      processed: 0,
      total: 0,
      success: 0,
      failed: 0,
      errors: [],
      conflicts: [],
      createdProducts: 0,
      updatedProducts: 0,
      createdVariants: 0,
      updatedVariants: 0,
      conflictCount: 0,
    };

    try {
      const toFiniteCount = (value, fallback = 0) =>
        Number.isFinite(Number(value)) ? Number(value) : fallback;

      const totalItems = groupRowsToProductPayload(parsedItems.value);
      _importStats.value.total = totalItems.length;
      const totalChunks = Math.ceil(totalItems.length / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = start + CHUNK_SIZE;
        const chunk = totalItems.slice(start, end);

        try {
          const result = await importProducts(chunk, { importMode: importMode.value });
          if (!workflow.isImportRequestActive(requestId)) return;
          const batchFailedCount = toFiniteCount(result?.summary?.failedProducts);
          const batchConflictCount = toFiniteCount(
            result?.summary?.conflicts,
            Array.isArray(result?.conflicts) ? result.conflicts.length : 0
          );
          if (result?.summary) {
            _importStats.value.createdProducts += toFiniteCount(result.summary.createdProducts);
            _importStats.value.updatedProducts += toFiniteCount(result.summary.updatedProducts);
            _importStats.value.createdVariants += toFiniteCount(result.summary.createdVariants);
            _importStats.value.updatedVariants += toFiniteCount(result.summary.updatedVariants);
            _importStats.value.conflictCount += batchConflictCount;
            _importStats.value.failed += batchFailedCount;
          }
          if (Array.isArray(result?.errors) && result.errors.length > 0) {
            _importStats.value.errors.push(...result.errors);
          }
          if (Array.isArray(result?.conflicts) && result.conflicts.length > 0) {
            const tagged = result.conflicts.map((conflict) => ({ batch: i + 1, ...conflict }));
            _importStats.value.conflicts.push(...tagged);
          }

          if (result.success) {
            _importStats.value.success += toFiniteCount(result.count, chunk.length);
          } else {
            const hasStructuredOutcome = batchFailedCount > 0 || batchConflictCount > 0;
            if (!hasStructuredOutcome) {
              _importStats.value.failed += chunk.length;
            }
            if (result?.error) {
              const errorMsg = `Batch ${i + 1} failed: ${result.error}`;
              _importStats.value.errors.push(errorMsg);
              console.error(errorMsg, result);
            } else if (!hasStructuredOutcome) {
              const errorMsg = `Batch ${i + 1} failed: Unknown error`;
              _importStats.value.errors.push(errorMsg);
              console.error(errorMsg, result);
            }
          }
        } catch (e) {
          if (!workflow.isImportRequestActive(requestId)) return;
          _importStats.value.failed += chunk.length;
          const errorMsg = `Batch ${i + 1} Exception: ${e.message}`;
          _importStats.value.errors.push(errorMsg);
          console.error(errorMsg, e);
        }

        _importStats.value.processed += chunk.length;
      }

      // Final result construction
      if (!workflow.isImportRequestActive(requestId)) return;
      const hasSuccess = _importStats.value.success > 0;
      importResult.value = {
        success: hasSuccess,
        count: _importStats.value.success,
        failed: _importStats.value.failed,
        errors: _importStats.value.errors,
        conflicts: _importStats.value.conflicts.slice(0, 500),
        summary: {
          createdProducts: _importStats.value.createdProducts,
          updatedProducts: _importStats.value.updatedProducts,
          createdVariants: _importStats.value.createdVariants,
          updatedVariants: _importStats.value.updatedVariants,
          conflicts: _importStats.value.conflictCount,
        },
      };

      if (_importStats.value.failed > 0) {
        if (hasSuccess) {
          addToast({
            message: t('product.import.stats_summary', {
              success: _importStats.value.success,
              failed: _importStats.value.failed,
            }),
            type: 'warning',
          });
        } else {
          addToast({
            message: t(
              'product.import.stats.all_failed',
              { failed: _importStats.value.failed },
              `导入失败: 全部 ${_importStats.value.failed} 条数据导入失败`
            ),
            type: 'error',
          });
        }
      } else if (_importStats.value.conflictCount > 0) {
        addToast({
          message: t(
            'product.import.conflicts.summary',
            { count: _importStats.value.conflictCount },
            `导入完成，检测到 ${_importStats.value.conflictCount} 条冲突并已跳过`
          ),
          type: 'warning',
        });
      } else {
        addToast({ message: t('common.success'), type: 'success' });
      }

      if (hasSuccess) {
        emit('success');
      }
    } catch (e) {
      if (!workflow.isImportRequestActive(requestId)) return;
      importError.value = e.message;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    importError,
    importResult,
    importStats,
    CHUNK_SIZE,
    handleImport,
    resetExecution,
  };
}
