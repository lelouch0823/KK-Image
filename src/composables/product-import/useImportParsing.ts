import { ref } from 'vue';
import { hasEntries } from '@/utils/object-utils';
import { formatSize } from '@/utils/formatters';
import { extractInternalCodes } from '@/utils/import-match-keys';
import {
  sanitizeMappedRow,
  isMeaningfulRow,
  createPreprocessStats,
  createValidationReport,
  VALID_VARIANT_STATUSES,
} from '@/utils/import-validators';
import type { MappedImportRow } from '@/utils/import-validators';

interface SpecConfig {
  id: string;
  name: string;
  column: string;
}

interface ValidationIssue {
  row: number;
  code: string;
  message: string;
}

export function useImportParsing({ t, addToast, workflow }) {
  const fileName = ref('');
  const fileSize = ref('');
  const fileHeaders = ref<string[]>([]);
  const rawFileRows = ref<unknown[][]>([]);
  const fieldMapping = ref<Record<string, string>>({});
  const specConfigs = ref<SpecConfig[]>([]);
  const importMode = ref('safe_merge');
  const parsedItems = ref<MappedImportRow[]>([]);
  const preprocessStats = ref(createPreprocessStats());
  const mappingValidationReport = ref(null);

  // --- Spec helpers ---
  const SPEC_PRESETS = [
    t('order.form.color', '颜色'),
    t('order.form.size', '尺寸'),
    t('order.form.material', '材质'),
  ];

  const createSpecConfig = (name = '', column = '') => ({
    id: `spec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    column,
  });

  const normalizeSpecName = (value) =>
    String(value || '')
      .trim()
      .toLowerCase();

  // Initialize specConfigs
  specConfigs.value = [createSpecConfig(SPEC_PRESETS[0], '')];

  // --- SYSTEM_FIELDS ---
  const SYSTEM_FIELDS = [
    { key: 'name', label: t('product.form.name'), required: true, aliases: ['品名', '标题', 'Name'] },
    {
      key: 'spu',
      label: t('product.form.spu'),
      required: false,
      aliases: ['款号', '货号', '编码', 'Code', 'SPU'],
    },
    {
      key: 'currency',
      label: t('product.form.currency'),
      required: false,
      aliases: ['币种', '货币', 'Currency'],
    },
    {
      key: 'sku',
      label: t('product.table.variant.sku'),
      required: false,
      aliases: ['SKU', 'Sku', '变体SKU', '子款号'],
    },
    {
      key: 'variant_code',
      label: t('product.import.fields.variant_code', '变体编码'),
      required: false,
      aliases: ['变体编码', 'variant code', 'Variant Code'],
    },
    {
      key: 'product_code',
      label: t('product.import.fields.product_code', '商品编码'),
      required: false,
      aliases: ['商品编码', 'product code', 'Product Code'],
    },
    {
      key: 'barcode',
      label: t('product.table.variant.barcode'),
      required: false,
      aliases: ['条码', 'Barcode'],
    },
    {
      key: 'supplier_sku',
      label: t('product.table.variant.supplier_sku'),
      required: false,
      aliases: ['供应商SKU', 'Supplier SKU', 'supplier_sku'],
    },
    {
      key: 'status',
      label: t('product.table.header.status'),
      required: false,
      aliases: ['状态', 'status', 'Status'],
    },
    {
      key: 'price',
      label: t('product.form.price'),
      required: false,
      aliases: ['售价', '销售价', '单价', '金额'],
    },
    {
      key: 'stock_quantity',
      label: t('product.form.stock'),
      required: false,
      aliases: ['数量', '存货', '库存数'],
    },
    {
      key: 'description',
      label: t('product.form.description'),
      required: false,
      aliases: ['详情', '备注', '介绍'],
    },
    {
      key: 'image_url',
      label: t('product.import.fields.image_url', '图片链接'),
      required: false,
      aliases: ['图片', '主图', 'Image'],
    },
    {
      key: 'category',
      label: t('product.form.category'),
      required: false,
      aliases: ['类别', '小类', '种类', '类目'],
    },
    {
      key: 'brand',
      label: t('order.form.brand'),
      required: false,
      aliases: ['品牌', '牌子', '厂家'],
    },
    { key: 'series', label: t('order.form.series'), required: false, aliases: ['系列', '系列名'] },
    {
      key: 'cost_price',
      label: t('product.form.cost'),
      required: false,
      aliases: ['成本', '进价', '进货价'],
    },
    {
      key: 'alert_threshold',
      label: t('product.form.alert_at'),
      required: false,
      aliases: ['预警线', '安全库存', '预警'],
    },
  ];

  // --- File size formatter ---
  const formatFileSize = (bytes) => formatSize(bytes);

  // --- XLSX lazy loader ---
  let _xlsx = null;
  async function getXLSX() {
    if (!_xlsx) _xlsx = await import('xlsx');
    return _xlsx;
  }

  // --- Process File ---
  const processFile = async (file) => {
    if (!file) return;
    const XLSX = await getXLSX();
    const requestId = workflow.getFileParseRequestId();

    if (!/\.(xlsx|xls|csv)$/.test(file.name)) {
      addToast({ message: 'Only Excel or CSV files are supported', type: 'error' });
      return;
    }

    fileName.value = file.name;
    fileSize.value = formatFileSize(file.size);

    try {
      const data = await file.arrayBuffer();
      if (!workflow.isFileParseActive(requestId)) return;
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length === 0) throw new Error('Empty file');

      const headers = (jsonData[0] || []).map((header) => String(header || ''));
      fileHeaders.value = headers;

      // Auto-match logic
      const newMapping = {};
      SYSTEM_FIELDS.forEach((field) => {
        const match = headers.find((h) => {
          const header = String(h).toLowerCase();
          return (
            header.includes(field.key.toLowerCase()) ||
            (field.label && header.includes(field.label)) ||
            (field.aliases && field.aliases.some((a) => header.includes(a)))
          );
        });
        if (match) newMapping[field.key] = match;
      });
      fieldMapping.value = newMapping;

      const detectedSpecs = [];
      const usedHeaders = new Set();
      SPEC_PRESETS.forEach((preset) => {
        const found = headers.find((h) => {
          const header = String(h || '')
            .trim()
            .toLowerCase();
          return header.includes(String(preset).toLowerCase()) && !usedHeaders.has(h);
        });
        if (found) {
          usedHeaders.add(found);
          detectedSpecs.push(createSpecConfig(preset, found));
        }
      });
      specConfigs.value =
        detectedSpecs.length > 0
          ? detectedSpecs.slice(0, 3)
          : [createSpecConfig(SPEC_PRESETS[0], '')];

      rawFileRows.value = jsonData.slice(1) as unknown[][];

      if (!workflow.isFileParseActive(requestId)) return;
      workflow.currentStep.value = 3;
    } catch (e) {
      if (!workflow.isFileParseActive(requestId)) return;
      console.error(e);
    }
  };

  // --- Confirm Mapping ---
  const handleConfirmMapping = () => {
    const requiredFields = ['name', 'sku'];
    const missingRequired = requiredFields.filter((key) => !fieldMapping.value[key]);
    if (missingRequired.length > 0) {
      addToast({
        type: 'error',
        message: t('product.import.error_missing_fields', '请至少映射"商品名称"和"SKU"字段'),
      });
      return;
    }

    const activeSpecs = (specConfigs.value || [])
      .map((spec) => ({
        name: String(spec?.name || '').trim(),
        column: String(spec?.column || '').trim(),
      }))
      .filter((spec) => spec.name || spec.column);

    if (activeSpecs.length > 3) {
      addToast({ type: 'error', message: t('product.import.specs.max_three', '最多支持 3 个规格') });
      return;
    }

    const hasPartialSpec = activeSpecs.some((spec) => !spec.name || !spec.column);
    if (hasPartialSpec) {
      addToast({
        type: 'error',
        message: t('product.import.specs.incomplete', '规格名和规格列必须同时填写'),
      });
      return;
    }

    const nameSet = new Set();
    for (const spec of activeSpecs) {
      const key = normalizeSpecName(spec.name);
      if (nameSet.has(key)) {
        addToast({
          type: 'error',
          message: t('product.import.specs.duplicate_name', '规格名不能重复'),
        });
        return;
      }
      nameSet.add(key);
    }

    const colSet = new Set();
    for (const spec of activeSpecs) {
      if (colSet.has(spec.column)) {
        addToast({
          type: 'error',
          message: t('product.import.specs.duplicate_column', '同一列不能绑定多个规格'),
        });
        return;
      }
      colSet.add(spec.column);
    }

    const nextPreprocessStats = createPreprocessStats();
    nextPreprocessStats.sourceRows = rawFileRows.value.length;
    const validationIssues: ValidationIssue[] = [];

    const mappedData = rawFileRows.value
      .map((row, idx) => {
        const rowNumber = idx + 2;
        const item: MappedImportRow = {};
        SYSTEM_FIELDS.forEach((field) => {
          const headerName = fieldMapping.value[field.key];
          if (headerName) {
            const colIndex = fileHeaders.value.indexOf(headerName);
            if (colIndex !== -1) {
              item[field.key] = row[colIndex];
              return;
            }
          }
          item[field.key] = undefined;
        });
        const extractedCodes = extractInternalCodes(fileHeaders.value, row);
        Object.entries(extractedCodes).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            item[key] = value;
          }
        });
        item.status = item.status ? String(item.status).trim() : 'active';

        if (activeSpecs.length > 0) {
          const optionsValues: Record<string, string> = {};
          activeSpecs.forEach((spec) => {
            const colIndex = fileHeaders.value.indexOf(spec.column);
            if (colIndex < 0) return;
            const raw = row[colIndex];
            const value = String(raw ?? '').trim();
            if (!value) return;
            optionsValues[spec.name] = value;
          });
          if (hasEntries(optionsValues)) {
            item.options_values = optionsValues;
          }
        }
        const cleaned = sanitizeMappedRow(item);
        if (JSON.stringify(cleaned) !== JSON.stringify(item)) {
          nextPreprocessStats.normalizedRows++;
        }
        if (!isMeaningfulRow(cleaned)) {
          nextPreprocessStats.droppedEmptyRows++;
          validationIssues.push({
            row: rowNumber,
            code: 'empty_row',
            message: t('product.import.preprocess.issue.empty_row', '整行为空或仅包含默认值'),
          });
          return null;
        }
        if (!String(cleaned.name || '').trim()) {
          validationIssues.push({
            row: rowNumber,
            code: 'missing_name',
            message: t('product.import.preprocess.issue.missing_name', '商品名称为空'),
          });
        }
        if (!String(cleaned.sku || '').trim()) {
          validationIssues.push({
            row: rowNumber,
            code: 'missing_sku',
            message: t('product.import.preprocess.issue.missing_sku', 'SKU 为空'),
          });
        }
        cleaned.__rowNumber = rowNumber;
        return cleaned;
      })
      .filter((item): item is MappedImportRow => Boolean(item));

    const nameMissingCount = mappedData.filter((item) => !String(item.name || '').trim()).length;
    if (nameMissingCount > 0) {
      mappingValidationReport.value = createValidationReport(validationIssues);
      addToast({
        type: 'error',
        message: t(
          'product.import.error_missing_name',
          '商品名称为必填字段，存在空值，请检查映射或源数据'
        ),
      });
      return;
    }

    const skuMissingCount = mappedData.filter((item) => !String(item.sku || '').trim()).length;
    if (skuMissingCount > 0) {
      mappingValidationReport.value = createValidationReport(validationIssues);
      addToast({
        type: 'error',
        message: t(
          'product.import.error_missing_sku',
          'SKU 为必填字段，存在空值，请检查映射或源数据'
        ),
      });
      return;
    }

    const invalidStatusRows = mappedData.filter(
      (item) => !VALID_VARIANT_STATUSES.has(String(item.status || '').trim())
    );
    if (invalidStatusRows.length > 0) {
      invalidStatusRows.forEach((item) => {
        validationIssues.push({
          row: Number(item.__rowNumber || 0),
          code: 'invalid_status',
          message: t('product.import.preprocess.issue.invalid_status', '状态值不受支持'),
        });
      });
      mappingValidationReport.value = createValidationReport(validationIssues);
      addToast({
        type: 'error',
        message: t('product.import.error_invalid_status', '存在不受支持的状态值，请修正后再导入'),
      });
      return;
    }

    const seenSku = new Set();
    const duplicateSkuSet = new Set();
    const duplicateSku = mappedData.find((item) => {
      const sku = String(item.sku || '').trim();
      if (!sku) return false;
      if (seenSku.has(sku)) {
        duplicateSkuSet.add(sku);
        return true;
      }
      seenSku.add(sku);
      return false;
    });
    if (duplicateSkuSet.size > 0) {
      mappedData.forEach((item) => {
        const sku = String(item.sku || '').trim();
        if (!duplicateSkuSet.has(sku)) return;
        validationIssues.push({
          row: Number(item.__rowNumber || 0),
          code: 'duplicate_sku',
          message: t('product.import.preprocess.issue.duplicate_sku', 'SKU 重复'),
        });
      });
    }
    if (duplicateSku) {
      mappingValidationReport.value = createValidationReport(validationIssues);
      addToast({
        type: 'error',
        message: t('product.import.error_duplicate_sku', '检测到重复 SKU，请去重后再导入'),
      });
      return;
    }

    const blankSpuRowsByName = mappedData.reduce((acc, item) => {
      const spu = String(item.spu || '').trim();
      const name = String(item.name || '').trim();
      if (spu || !name) return acc;
      if (!acc.has(name)) {
        acc.set(name, []);
      }
      acc.get(name).push(item);
      return acc;
    }, new Map<string, MappedImportRow[]>());

    const duplicateNameWithoutSpu = Array.from(blankSpuRowsByName.entries()).filter(
      ([, rows]) => rows.length > 1
    );
    if (duplicateNameWithoutSpu.length > 0) {
      duplicateNameWithoutSpu.forEach(([, rows]) => {
        rows.forEach((item) => {
          validationIssues.push({
            row: Number(item.__rowNumber || 0),
            code: 'duplicate_name_without_spu',
            message: t(
              'product.import.preprocess.issue.duplicate_name_without_spu',
              '同名多行未提供 SPU，无法安全合并为同一商品'
            ),
          });
        });
      });
      mappingValidationReport.value = createValidationReport(validationIssues);
      addToast({
        type: 'error',
        message: t(
          'product.import.error_duplicate_name_without_spu',
          '检测到同名多行但未提供 SPU，无法安全分组，请补充 SPU 后再导入'
        ),
      });
      return;
    }

    nextPreprocessStats.acceptedRows = mappedData.length;
    preprocessStats.value = nextPreprocessStats;
    mappingValidationReport.value = createValidationReport(validationIssues);
    parsedItems.value = mappedData.map(({ __rowNumber, ...item }) => item);

    const hasLocalImages = mappedData.some(
      (item) =>
        item.image_url && typeof item.image_url === 'string' && !item.image_url.match(/^https?:\/\//i)
    );

    if (hasLocalImages) {
      workflow.currentStep.value = 5;
    } else {
      workflow.currentStep.value = 4;
    }
  };

  // --- Reset ---
  const resetParsing = () => {
    fileName.value = '';
    fileSize.value = '';
    fileHeaders.value = [];
    rawFileRows.value = [];
    fieldMapping.value = {};
    specConfigs.value = [createSpecConfig(SPEC_PRESETS[0], '')];
    importMode.value = 'safe_merge';
    parsedItems.value = [];
    preprocessStats.value = createPreprocessStats();
    mappingValidationReport.value = null;
  };

  return {
    fileName,
    fileSize,
    fileHeaders,
    rawFileRows,
    fieldMapping,
    specConfigs,
    importMode,
    parsedItems,
    preprocessStats,
    mappingValidationReport,
    SYSTEM_FIELDS,
    processFile,
    handleConfirmMapping,
    resetParsing,
  };
}
