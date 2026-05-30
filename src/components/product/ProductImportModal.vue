<template>
  <Modal 
    :model-value="modelValue" 
    :title="t('product.import.title')"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div data-testid="product-import-modal" class="space-y-6">
      <div class="rounded-xl border border-(--border-color) bg-(--bg-card) p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-(--text-main)">{{ t('product.import.workflow_title', '导入流程') }}</h3>
          <span class="text-xs text-(--text-secondary)">{{ t('product.import.workflow_step', { current: currentStepIndex, total: WORKFLOW_STEPS.length }, '步骤 {current}/{total}') }}</span>
        </div>
        <div class="relative mb-3 grid grid-cols-4 gap-2">
          <div class="absolute top-4 right-0 left-0 h-px bg-(--border-color)"></div>
          <div
            v-for="step in WORKFLOW_STEPS"
            :key="step.id"
            class="relative z-10 flex flex-col items-center gap-1"
          >
            <div
              class="flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors"
              :class="getWorkflowStepClass(step.order)"
            >
              <AppIcon v-if="isWorkflowCompleted(step.order)" name="check" class="size-4" />
              <span v-else>{{ step.order }}</span>
            </div>
            <span class="text-center text-[11px] leading-4" :class="isWorkflowActive(step.order) ? 'text-primary font-semibold' : 'text-(--text-secondary)'">
              {{ step.label }}
            </span>
          </div>
        </div>
        <p class="text-xs text-(--text-secondary)">{{ currentWorkflowHint }}</p>
      </div>

      <!-- Step 1 & 2: Upload -->
      <ImportUploadStep 
        v-if="currentStep === 1" 
        @file-selected="processFile" 
      />

      <!-- Step 3: Mapping -->
      <ImportMappingStep 
        v-if="currentStep === 3" 
        v-model="fieldMapping" 
        v-model:spec-configs="specConfigs"
        v-model:import-mode="importMode"
        :file-headers="fileHeaders" 
        :system-fields="SYSTEM_FIELDS" 
        :validation-report="mappingValidationReport"
      />

      <!-- Step 5: Image Match -->
      <ImportImageMatchStep 
        v-if="currentStep === 5"
        :parsed-items="parsedItems" 
        :image-matches="imageMatches"
        :processed-images-count="processedImagesCount"
        :total-images-count="totalImagesCount"
        :file-count="imageUploadFiles.length"
        @files-selected="handleImageFiles"
      />

      <!-- Step 4: Preview & Result -->
      <ImportPreviewStep 
          v-if="currentStep === 4"
          :file-name="fileName"
          :file-size="fileSize"
          :parsed-items="parsedItems"
          :preprocess-stats="preprocessStats"
          :loading="loading"
          :import-result="importResult"
          :import-error="importError"
          :import-stats="importStats"
          :chunk-size="CHUNK_SIZE"
          @reset="resetFile"
      />
    </div>

    <!-- Footer Actions -->
    <template #footer>
        <AppButton
            variant="ghost"
            data-testid="product-import-close"
            class="mr-2"
            :disabled="loading"
            @click="currentStep === 1 ? $emit('update:modelValue', false) : handleBack()"
        >
            {{ currentStep === 1 ? t('common.cancel') : t('product.import.back') }}
        </AppButton>
        
        <AppButton
            v-if="currentStep === 3"
            data-testid="product-import-confirm-mapping"
            @click="handleConfirmMapping"
        >
            {{ t('product.import.confirm_mapping') }}
        </AppButton>

        <AppButton
            v-if="currentStep === 5"
            data-testid="product-import-upload-next"
            :disabled="loading"
            :loading="loading"
            :loading-text="t('product.import.uploading')"
            @click="handleUploadImagesAndNext"
        >
            {{ t('product.import.upload_and_continue') }}
        </AppButton>

        <AppButton
            v-if="currentStep === 4"
            data-testid="product-import-submit"
            :disabled="!parsedItems.length || loading"
            :loading="loading"
            :loading-text="t('product.import.importing', { current: importStats.processed, total: importStats.total })"
            @click="importResult && importResult.success ? $emit('update:modelValue', false) : handleImport()"
        >
            {{ 
                importResult 
                    ? (importResult.success ? t('common.complete') : t('common.retry'))
                    : t('product.import.action')
            }}
        </AppButton>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

// Step Components
import ImportUploadStep from '@/components/product/import/ImportUploadStep.vue';
import ImportMappingStep from '@/components/product/import/ImportMappingStep.vue';
import ImportImageMatchStep from '@/components/product/import/ImportImageMatchStep.vue';
import ImportPreviewStep from '@/components/product/import/ImportPreviewStep.vue';
import { extractInternalCodes, getItemMatchKey } from '@/components/product/import/match-keys.js';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    }
});
const emit = defineEmits(['update:modelValue', 'success']);

const { t } = useI18n();
const { addToast } = useToast();
const { importProducts } = useProducts(); 
const { authFetch } = useAuth();

const fileName = ref('');
const fileSize = ref('');
const parsedItems = ref([]);
const preprocessStats = ref({
    sourceRows: 0,
    acceptedRows: 0,
    droppedEmptyRows: 0,
    normalizedRows: 0
});
const mappingValidationReport = ref(null);
const loading = ref(false);
const importError = ref(null);
const importResult = ref(null);
let importRequestId = 0;
let imageUploadRequestId = 0;
let fileParseRequestId = 0;

// -- state for mapping --
const currentStep = ref(1); // 1: Upload, 3: Mapping, 4: Preview
const fileHeaders = ref([]);
const rawFileRows = ref([]);
const fieldMapping = ref({});
const specConfigs = ref([]);
const importMode = ref('safe_merge');

const WORKFLOW_STEPS = [
    { id: 'upload', order: 1, label: t('product.import.step_upload', '上传文件'), hint: t('product.import.workflow_hint_upload', '上传 Excel/CSV 并自动识别列头') },
    { id: 'mapping', order: 2, label: t('product.import.step_mapping', '列映射'), hint: t('product.import.workflow_hint_mapping', '确认字段映射、规格配置与导入策略') },
    { id: 'images', order: 3, label: t('product.import.step_image', '图片匹配'), hint: t('product.import.workflow_hint_images', '可选：为本地图片引用匹配文件') },
    { id: 'preview', order: 4, label: t('product.import.step_verify', '确认导入'), hint: t('product.import.workflow_hint_preview', '查看统计、冲突与导入结果') },
];

const currentStepIndex = computed(() => {
    if (currentStep.value === 1) return 1;
    if (currentStep.value === 3) return 2;
    if (currentStep.value === 5) return 3;
    if (currentStep.value === 4) return 4;
    return 1;
});

const isWorkflowCompleted = (order) => currentStepIndex.value > order;
const isWorkflowActive = (order) => currentStepIndex.value === order;
const getWorkflowStepClass = (order) => {
    if (isWorkflowCompleted(order)) return 'border-success bg-success/10 text-success';
    if (isWorkflowActive(order)) return 'border-primary bg-primary/10 text-primary';
    return 'border-(--border-color) bg-(--bg-muted) text-(--text-secondary)';
};
const currentWorkflowHint = computed(() => (
    WORKFLOW_STEPS.find((step) => step.order === currentStepIndex.value)?.hint || ''
));

const SYSTEM_FIELDS = [
    { key: 'name', label: t('product.form.name'), required: true, aliases: ['品名', '标题', 'Name'] },
    { key: 'spu', label: t('product.form.spu'), required: false, aliases: ['款号', '货号', '编码', 'Code', 'SPU'] },
    { key: 'currency', label: t('product.form.currency'), required: false, aliases: ['币种', '货币', 'Currency'] },
    { key: 'sku', label: t('product.table.variant.sku'), required: false, aliases: ['SKU', 'Sku', '变体SKU', '子款号'] },
    { key: 'variant_code', label: t('product.import.fields.variant_code', '变体编码'), required: false, aliases: ['变体编码', 'variant code', 'Variant Code'] },
    { key: 'product_code', label: t('product.import.fields.product_code', '商品编码'), required: false, aliases: ['商品编码', 'product code', 'Product Code'] },
    { key: 'barcode', label: t('product.table.variant.barcode'), required: false, aliases: ['条码', 'Barcode'] },
    { key: 'supplier_sku', label: t('product.table.variant.supplier_sku'), required: false, aliases: ['供应商SKU', 'Supplier SKU', 'supplier_sku'] },
    { key: 'status', label: t('product.table.header.status'), required: false, aliases: ['状态', 'status', 'Status'] },
    { key: 'price', label: t('product.form.price'), required: false, aliases: ['售价', '销售价', '单价', '金额'] }, 
    { key: 'stock_quantity', label: t('product.form.stock'), required: false, aliases: ['数量', '存货', '库存数'] }, 
    { key: 'description', label: t('product.form.description'), required: false, aliases: ['详情', '备注', '介绍'] },
    { key: 'image_url', label: t('product.import.fields.image_url', '图片链接'), required: false, aliases: ['图片', '主图', 'Image'] },
    { key: 'category', label: t('product.form.category'), required: false, aliases: ['类别', '小类', '种类', '类目'] },
    { key: 'brand', label: t('order.form.brand'), required: false, aliases: ['品牌', '牌子', '厂家'] },
    { key: 'series', label: t('order.form.series'), required: false, aliases: ['系列', '系列名'] },
    { key: 'cost_price', label: t('product.form.cost'), required: false, aliases: ['成本', '进价', '进货价'] },
    { key: 'alert_threshold', label: t('product.form.alert_at'), required: false, aliases: ['预警线', '安全库存', '预警'] },
];

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

const normalizeSpecName = (value) => String(value || '').trim().toLowerCase();
const NUMERIC_FIELDS = new Set(['price', 'cost_price', 'stock_quantity', 'alert_threshold']);
const PRODUCT_FIELDS = new Set(['name', 'spu', 'currency', 'category', 'brand', 'series', 'description']);
const VALID_VARIANT_STATUSES = new Set(['active', 'archived']);

const normalizeNumeric = (value) => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    const normalized = String(value).trim().replace(/,/g, '');
    if (!normalized) return undefined;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : undefined;
};

const normalizeStatus = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'active';
    if (['active', 'enabled', 'on', '1', '上架', '启用'].includes(raw)) return 'active';
    if (['inactive', 'disabled', 'off', '0', '下架', '停用'].includes(raw)) return 'archived';
    if (['archived', 'archive', '归档'].includes(raw)) return 'archived';
    return raw;
};

const normalizeCurrency = (value) => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return undefined;
    return /^[A-Z]{3}$/.test(raw) ? raw : undefined;
};

const sanitizeOptionsValues = (value) => {
    if (!value || typeof value !== 'object') return undefined;
    const next = Object.entries(value).reduce((acc, [k, v]) => {
        const key = String(k || '').trim();
        const val = String(v || '').trim();
        if (key && val) acc[key] = val;
        return acc;
    }, {});
    return Object.keys(next).length > 0 ? next : undefined;
};

const sanitizeMappedRow = (row) => {
    const clean = {};
    Object.entries(row || {}).forEach(([key, raw]) => {
        if (key === 'options_values') return;
        if (NUMERIC_FIELDS.has(key)) {
            const n = normalizeNumeric(raw);
            if (n !== undefined) clean[key] = n;
            return;
        }
        if (key === 'status') {
            clean.status = normalizeStatus(raw);
            return;
        }
        if (key === 'currency') {
            const normalized = normalizeCurrency(raw);
            if (normalized) clean.currency = normalized;
            return;
        }
        const str = String(raw ?? '').trim();
        if (!str) return;
        clean[key] = str;
    });
    if (!clean.status) clean.status = 'active';

    const optionsValues = sanitizeOptionsValues(row?.options_values);
    if (optionsValues) {
        clean.options_values = optionsValues;
    }
    return clean;
};

specConfigs.value = [createSpecConfig(SPEC_PRESETS[0], '')];

const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const createPreprocessStats = () => ({
    sourceRows: 0,
    acceptedRows: 0,
    droppedEmptyRows: 0,
    normalizedRows: 0
});

const createValidationReport = (issues) => {
    const list = Array.isArray(issues) ? issues : [];
    const byCode = list.reduce((acc, issue) => {
        const code = String(issue?.code || 'unknown');
        acc[code] = (acc[code] || 0) + 1;
        return acc;
    }, {});
    return {
        total: list.length,
        byCode,
        samples: list.slice(0, 20),
    };
};

const isMeaningfulRow = (item) => {
    const keys = Object.keys(item || {});
    if (keys.length === 0) return false;
    if (keys.length === 1 && keys[0] === 'status') return false;
    return true;
};

const resetFile = () => {
    fileName.value = '';
    fileSize.value = '';
    parsedItems.value = [];
    imageUploadFiles.value = [];
    imageMatches.value = new Map();
    preprocessStats.value = createPreprocessStats();
    mappingValidationReport.value = null;
    fileHeaders.value = [];
    rawFileRows.value = [];
    fieldMapping.value = {};
    specConfigs.value = [createSpecConfig(SPEC_PRESETS[0], '')];
    importMode.value = 'safe_merge';
    importError.value = null;
    importResult.value = null;
    loading.value = false;
    currentStep.value = 1;
};

const invalidateImportRequest = () => {
    importRequestId += 1;
    imageUploadRequestId += 1;
    fileParseRequestId += 1;
};

const isImportRequestActive = (requestId) => requestId === importRequestId && props.modelValue;
const isImageUploadActive = (requestId) => requestId === imageUploadRequestId && props.modelValue;
const isFileParseActive = (requestId) => requestId === fileParseRequestId && props.modelValue;

watch(() => props.modelValue, (visible) => {
    if (!visible) {
        invalidateImportRequest();
        resetFile();
    }
});

// --- Parsers ---
let _xlsx = null;
async function getXLSX() {
    if (!_xlsx) _xlsx = await import('xlsx');
    return _xlsx;
}

const processFile = async (file) => {
    if (!file) return;
    const XLSX = await getXLSX();
    const requestId = ++fileParseRequestId;
    
    // Basic validations
    if (!/\.(xlsx|xls|csv)$/.test(file.name)) {
        addToast({ message: 'Only Excel or CSV files are supported', type: 'error' });
        return;
    }

    fileName.value = file.name;
    fileSize.value = formatFileSize(file.size);
    importError.value = null;
    importResult.value = null;

    try {
        const data = await file.arrayBuffer();
        if (!isFileParseActive(requestId)) return;
        const workbook = XLSX.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with header: 1 to get raw array of arrays
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) throw new Error('Empty file');

        const headers = jsonData[0];
        fileHeaders.value = headers;
        
        // Auto-match logic
        const newMapping = {};
        SYSTEM_FIELDS.forEach(field => {
            const match = headers.find(h => {
                const header = String(h).toLowerCase();
                 return header.includes(field.key.toLowerCase()) || 
                       (field.label && header.includes(field.label)) ||
                       (field.aliases && field.aliases.some(a => header.includes(a)));
            });
            if (match) newMapping[field.key] = match;
        });
        fieldMapping.value = newMapping;

        const detectedSpecs = [];
        const usedHeaders = new Set();
        SPEC_PRESETS.forEach((preset) => {
            const found = headers.find((h) => {
                const header = String(h || '').trim().toLowerCase();
                return header.includes(String(preset).toLowerCase()) && !usedHeaders.has(h);
            });
            if (found) {
                usedHeaders.add(found);
                detectedSpecs.push(createSpecConfig(preset, found));
            }
        });
        specConfigs.value = detectedSpecs.length > 0
            ? detectedSpecs.slice(0, 3)
            : [createSpecConfig(SPEC_PRESETS[0], '')];

        // Store raw data (excluding header)
        rawFileRows.value = jsonData.slice(1);
        
        // Move to mapping step
        if (!isFileParseActive(requestId)) return;
        currentStep.value = 3;

    } catch (e) {
        if (!isFileParseActive(requestId)) return;
        console.error(e);
        importError.value = t('product.import.error_parse', '文件解析失败');
    }
};

const handleConfirmMapping = () => {
    const requiredFields = ['name', 'sku'];
    const missingRequired = requiredFields.filter((key) => !fieldMapping.value[key]);
    if (missingRequired.length > 0) {
        addToast({ type: 'error', message: t('product.import.error_missing_fields', '请至少映射“商品名称”和“SKU”字段') });
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
        addToast({ type: 'error', message: t('product.import.specs.incomplete', '规格名和规格列必须同时填写') });
        return;
    }

    const nameSet = new Set();
    for (const spec of activeSpecs) {
        const key = normalizeSpecName(spec.name);
        if (nameSet.has(key)) {
            addToast({ type: 'error', message: t('product.import.specs.duplicate_name', '规格名不能重复') });
            return;
        }
        nameSet.add(key);
    }

    const colSet = new Set();
    for (const spec of activeSpecs) {
        if (colSet.has(spec.column)) {
            addToast({ type: 'error', message: t('product.import.specs.duplicate_column', '同一列不能绑定多个规格') });
            return;
        }
        colSet.add(spec.column);
    }

    const nextPreprocessStats = createPreprocessStats();
    nextPreprocessStats.sourceRows = rawFileRows.value.length;
    const validationIssues = [];

    const mappedData = rawFileRows.value.map((row, idx) => {
        const rowNumber = idx + 2;
        const item = {};
        SYSTEM_FIELDS.forEach(field => {
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
        // Default Status
        item.status = item.status ? String(item.status).trim() : 'active';

        if (activeSpecs.length > 0) {
            const optionsValues = {};
            activeSpecs.forEach((spec) => {
                const colIndex = fileHeaders.value.indexOf(spec.column);
                if (colIndex < 0) return;
                const raw = row[colIndex];
                const value = String(raw ?? '').trim();
                if (!value) return;
                optionsValues[spec.name] = value;
            });
            if (Object.keys(optionsValues).length > 0) {
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
    }).filter(Boolean);

    const nameMissingCount = mappedData.filter((item) => !String(item.name || '').trim()).length;
    if (nameMissingCount > 0) {
        mappingValidationReport.value = createValidationReport(validationIssues);
        addToast({ type: 'error', message: t('product.import.error_missing_name', '商品名称为必填字段，存在空值，请检查映射或源数据') });
        return;
    }

    const skuMissingCount = mappedData.filter((item) => !String(item.sku || '').trim()).length;
    if (skuMissingCount > 0) {
        mappingValidationReport.value = createValidationReport(validationIssues);
        addToast({ type: 'error', message: t('product.import.error_missing_sku', 'SKU 为必填字段，存在空值，请检查映射或源数据') });
        return;
    }

    const invalidStatusRows = mappedData.filter((item) => !VALID_VARIANT_STATUSES.has(String(item.status || '').trim()));
    if (invalidStatusRows.length > 0) {
        invalidStatusRows.forEach((item) => {
            validationIssues.push({
                row: Number(item.__rowNumber || 0),
                code: 'invalid_status',
                message: t('product.import.preprocess.issue.invalid_status', '状态值不受支持'),
            });
        });
        mappingValidationReport.value = createValidationReport(validationIssues);
        addToast({ type: 'error', message: t('product.import.error_invalid_status', '存在不受支持的状态值，请修正后再导入') });
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
        addToast({ type: 'error', message: t('product.import.error_duplicate_sku', '检测到重复 SKU，请去重后再导入') });
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
    }, new Map());

    const duplicateNameWithoutSpu = Array.from(blankSpuRowsByName.entries())
        .filter(([, rows]) => rows.length > 1);
    if (duplicateNameWithoutSpu.length > 0) {
        duplicateNameWithoutSpu.forEach(([, rows]) => {
            rows.forEach((item) => {
                validationIssues.push({
                    row: Number(item.__rowNumber || 0),
                    code: 'duplicate_name_without_spu',
                    message: t('product.import.preprocess.issue.duplicate_name_without_spu', '同名多行未提供 SPU，无法安全合并为同一商品'),
                });
            });
        });
        mappingValidationReport.value = createValidationReport(validationIssues);
        addToast({
            type: 'error',
            message: t('product.import.error_duplicate_name_without_spu', '检测到同名多行但未提供 SPU，无法安全分组，请补充 SPU 后再导入'),
        });
        return;
    }

    nextPreprocessStats.acceptedRows = mappedData.length;
    preprocessStats.value = nextPreprocessStats;
    mappingValidationReport.value = createValidationReport(validationIssues);
    parsedItems.value = mappedData.map(({ __rowNumber, ...item }) => item);

    // Check if we need image upload (if image_url is present but not HTTP URL)
    const hasLocalImages = mappedData.some(item => 
        item.image_url && 
        typeof item.image_url === 'string' && 
        !item.image_url.match(/^https?:\/\//i)
    );

    if (hasLocalImages) {
        currentStep.value = 5; // Go to Image Upload Step
    } else {
        currentStep.value = 4; // Go to Preview
    }
};

// --- Image Matching Logic (Step 5) ---
const imageUploadFiles = ref([]);
const imageMatches = ref(new Map()); // spu -> File

const handleImageFiles = (files) => {
    // Convert FileList to Array
    const fileArray = Array.from(files || []);
    imageUploadFiles.value = [...imageUploadFiles.value, ...fileArray];
    performImageMatch();
};

const performImageMatch = () => {
    // Basic fuzzy match: file.name includes item.image_url (filename from excel)
    const newMatches = new Map();
    
    parsedItems.value.forEach(item => {
        if (!item.image_url || item.image_url.match(/^https?:\/\//i)) return;
        
        // Target filename from Excel
        const target = String(item.image_url).trim();
        
        // Find matching file
        const match = imageUploadFiles.value.find(f => 
            f.name === target || 
            f.name.includes(target) // Loose matching
        );
        
        if (match) {
            newMatches.set(getItemMatchKey(item), match);
        }
    });
    imageMatches.value = newMatches;
};

const processedImagesCount = computed(() => imageMatches.value.size);
const totalImagesCount = computed(() => parsedItems.value.filter(i => i.image_url && !i.image_url.match(/^https?:\/\//i)).length);

const handleUploadImagesAndNext = async () => {
    if (imageMatches.value.size === 0) {
        if (!confirm(t('product.import.match_hint'))) return;
        currentStep.value = 4;
        return;
    }

    const requestId = ++imageUploadRequestId;
    loading.value = true;
    try {
        // Upload matched images
        // We do this one by one or batched.
        const matches = Array.from(imageMatches.value.entries());
        let uploadedCount = 0;
        let failedCount = 0;
        
        for (const [key, file] of matches) {
            const formData = new FormData();
            formData.append('file', file);
            
            // Upload to API
            const res = await authFetch(`${API.MANAGE_UPLOAD}?context=product`, {
                method: 'POST',
                body: formData
            });
            if (!isImageUploadActive(requestId)) return;
            const data = await res.json();
            if (!isImageUploadActive(requestId)) return;
            
            if (data.success) {
                // Update item with returned ID (or URL if needed, but CreateModal uses ID)
                const item = parsedItems.value.find(i => getItemMatchKey(i) === key);
                if (item) {
                     // The backend expects array of IDs for 'images' field
                     // But parsedItems currently has 'image_url' field string.
                     // We should convert to 'images' array.
                     item.images = [data.result.id];
                     delete item.image_url; // Remove the temporary filename
                }
                uploadedCount++;
            } else {
                failedCount++;
            }
        }

        if (!isImageUploadActive(requestId)) return;
        if (uploadedCount === 0) {
            addToast({
                message: t('product.import.upload_failed', { message: t('common.operationFailed') }),
                type: 'error'
            });
            return;
        }
        if (failedCount > 0) {
            addToast({
                message: t(
                    'product.import.upload_partial',
                    { success: uploadedCount, failed: failedCount },
                    `已上传 ${uploadedCount} 张图片，${failedCount} 张失败`
                ),
                type: 'warning'
            });
        } else {
            addToast({ message: t('product.import.upload_success', { count: uploadedCount }), type: 'success' });
        }
        currentStep.value = 4; // To Preview
        
    } catch (e) {
        if (!isImageUploadActive(requestId)) return;
        console.error(e);
        addToast({ message: t('product.import.upload_failed', { message: e.message }), type: 'error' });
    } finally {
        if (requestId === imageUploadRequestId) {
            loading.value = false;
        }
    }
};

// Back to upload
const handleBack = () => {
    if (currentStep.value === 3) {
        resetFile();
    } else if (currentStep.value === 5) {
        currentStep.value = 3;
    } else if (currentStep.value === 4) {
        const hasImageWorkflowState = imageUploadFiles.value.length > 0 || imageMatches.value.size > 0;
        currentStep.value = hasImageWorkflowState ? 5 : 3;
    }
};

const CHUNK_SIZE = 200;
const importStats = computed(() => {
    return _importStats.value;
});
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

const handleImport = async () => {
    if (!parsedItems.value.length) return;
    const requestId = ++importRequestId;
    
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
        const toFiniteCount = (value, fallback = 0) => (
            Number.isFinite(Number(value)) ? Number(value) : fallback
        );

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
                    const groupedRows = rows.filter((candidate, candidateIndex) => buildGroupKey(candidate, candidateIndex) === key);
                    groups.set(key, {
                        name: row.name,
                        spu: String(row.spu || '').trim() || undefined,
                        currency: row.currency,
                        category: row.category,
                        brand: row.brand,
                        series: row.series,
                        description: row.description,
                        dimensions: buildDimensionsFromRows(groupedRows),
                        variants: []
                    });
                }
                const product = groups.get(key);
                product.variants.push(normalizeVariantFromRow(row));
            });
            return Array.from(groups.values());
        };

        const totalItems = groupRowsToProductPayload(parsedItems.value);
        _importStats.value.total = totalItems.length;
        const totalChunks = Math.ceil(totalItems.length / CHUNK_SIZE);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = start + CHUNK_SIZE;
            const chunk = totalItems.slice(start, end);
            
            try {
                const result = await importProducts(chunk, { importMode: importMode.value });
                if (!isImportRequestActive(requestId)) return;
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
                        const errorMsg = `Batch ${i+1} failed: ${result.error}`;
                        _importStats.value.errors.push(errorMsg);
                        console.error(errorMsg, result);
                    } else if (!hasStructuredOutcome) {
                        const errorMsg = `Batch ${i+1} failed: Unknown error`;
                        _importStats.value.errors.push(errorMsg);
                        console.error(errorMsg, result);
                    }
                }
            } catch (e) {
                if (!isImportRequestActive(requestId)) return;
                _importStats.value.failed += chunk.length;
                const errorMsg = `Batch ${i+1} Exception: ${e.message}`;
                _importStats.value.errors.push(errorMsg);
                console.error(errorMsg, e);
            }
            
            _importStats.value.processed += chunk.length;
        }

        // Final result construction
        if (!isImportRequestActive(requestId)) return;
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
            }
        };
        
        if (_importStats.value.failed > 0) {
             if (hasSuccess) {
                 addToast({ message: t('product.import.stats_summary', { success: _importStats.value.success, failed: _importStats.value.failed }), type: 'warning' });
             } else {
                 addToast({ message: t('product.import.stats.all_failed', { failed: _importStats.value.failed }, `导入失败: 全部 ${_importStats.value.failed} 条数据导入失败`), type: 'error' });
             }
        } else if (_importStats.value.conflictCount > 0) {
             addToast({ message: t('product.import.conflicts.summary', { count: _importStats.value.conflictCount }, `导入完成，检测到 ${_importStats.value.conflictCount} 条冲突并已跳过`), type: 'warning' });
        } else {
             addToast({ message: t('common.success'), type: 'success' });
        }

        if (hasSuccess) {
            emit('success');
        }

    } catch (e) {
        if (!isImportRequestActive(requestId)) return;
        importError.value = e.message;
    } finally {
        if (requestId === importRequestId) {
            loading.value = false;
        }
    }
};
</script>
