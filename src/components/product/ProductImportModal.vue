<template>
  <Modal 
    :model-value="modelValue" 
    :title="t('product.import.title')"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-6">
      <!-- Step 1 & 2: Upload -->
      <ImportUploadStep 
        v-if="currentStep === 1" 
        @file-selected="processFile" 
      />

      <!-- Step 3: Mapping -->
      <ImportMappingStep 
        v-if="currentStep === 3" 
        v-model="fieldMapping" 
        :file-headers="fileHeaders" 
        :system-fields="SYSTEM_FIELDS" 
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
        <button 
            type="button" 
            class="btn btn-ghost mr-2" 
            :disabled="loading"
            @click="currentStep === 1 ? $emit('update:modelValue', false) : handleBack()"
        >
            {{ currentStep === 1 ? t('common.cancel') : t('product.import.back') }}
        </button>
        
        <button v-if="currentStep === 3" type="button" class="btn btn-primary" @click="handleConfirmMapping">
            {{ t('product.import.confirm_mapping') }}
        </button>

        <button v-if="currentStep === 5" type="button" class="btn btn-primary" :disabled="loading" @click="handleUploadImagesAndNext">
            <AppIcon v-if="loading" name="spinner" class="mr-2 size-4 animate-spin" />
            {{ loading ? t('product.import.uploading') : t('product.import.upload_and_continue') }}
        </button>

        <button 
            v-if="currentStep === 4"
            type="button" 
            class="btn btn-primary"
            :disabled="!parsedItems.length || loading"
            @click="importResult && importResult.success ? $emit('update:modelValue', false) : handleImport()"
        >
            <AppIcon v-if="loading" name="spinner" class="mr-2 size-4 animate-spin" />
            {{ 
                loading 
                    ? t('product.import.importing', { current: importStats.processed, total: importStats.total }) 
                    : (importResult 
                        ? (importResult.success ? t('common.complete') : t('common.retry'))
                        : t('product.import.action')) 
            }}
        </button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import * as XLSX from 'xlsx';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { API } from '@/utils/constants';
import AppIcon from '@/components/ui/AppIcon.vue';

// Step Components
import ImportUploadStep from '@/components/product/import/ImportUploadStep.vue';
import ImportMappingStep from '@/components/product/import/ImportMappingStep.vue';
import ImportImageMatchStep from '@/components/product/import/ImportImageMatchStep.vue';
import ImportPreviewStep from '@/components/product/import/ImportPreviewStep.vue';
import { extractInternalCodes, getItemMatchKey } from '@/components/product/import/match-keys.js';

defineProps({
    modelValue: {
        type: Boolean,
        default: false
    }
});
const emit = defineEmits(['update:modelValue', 'success']);

const { t } = useI18n();
const { addToast } = useToast();
const { importProducts } = useProducts(); 

const fileName = ref('');
const fileSize = ref('');
const parsedItems = ref([]);
const loading = ref(false);
const importError = ref(null);
const importResult = ref(null);

// -- state for mapping --
const currentStep = ref(1); // 1: Upload, 3: Mapping, 4: Preview
const fileHeaders = ref([]);
const rawFileRows = ref([]);
const fieldMapping = ref({});

const SYSTEM_FIELDS = [
    { key: 'name', label: t('product.form.name'), required: true, aliases: ['品名', '标题', 'Name'] },
    { key: 'spu', label: t('product.form.spu'), required: false, aliases: ['款号', '货号', '编码', 'Code', 'SPU'] },
    { key: 'price', label: t('product.form.price'), required: false, aliases: ['售价', '销售价', '单价', '金额'] }, 
    { key: 'stock_quantity', label: t('product.form.stock'), required: false, aliases: ['数量', '存货', '库存数'] }, 
    { key: 'description', label: t('product.form.description'), required: false, aliases: ['详情', '备注', '介绍'] },
    { key: 'image_url', label: t('product.import.fields.image_url', '图片链接'), required: false, aliases: ['图片', '主图', 'Image'] },
    { key: 'category', label: t('product.form.category'), required: false, aliases: ['类别', '小类', '种类', '类目'] },
    { key: 'brand', label: t('order.form.brand'), required: false, aliases: ['品牌', '牌子', '厂家'] },
    { key: 'series', label: t('order.form.series'), required: false, aliases: ['系列', '系列名'] },
    { key: 'cost_price', label: t('product.form.cost'), required: false, aliases: ['成本', '进价', '进货价'] },
    { key: 'alert_threshold', label: t('product.form.alert_at'), required: false, aliases: ['预警线', '安全库存', '预警'] },
    // Specifications
    { key: 'color', label: t('order.form.color'), required: false, aliases: ['颜色', '色号', '花色'], isSpec: true },
    { key: 'size', label: t('order.form.size'), required: false, aliases: ['尺寸', '规格', '尺寸'], isSpec: true },
    { key: 'material', label: t('order.form.material'), required: false, aliases: ['材质', '面料', '成分'], isSpec: true }
];

const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const resetFile = () => {
    fileName.value = '';
    parsedItems.value = [];
    fileHeaders.value = [];
    rawFileRows.value = [];
    fieldMapping.value = {};
    importError.value = null;
    importResult.value = null;
    currentStep.value = 1;
};

// --- Parsers ---
const processFile = async (file) => {
    if (!file) return;
    
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

        // Store raw data (excluding header)
        rawFileRows.value = jsonData.slice(1);
        
        // Move to mapping step
        currentStep.value = 3;

    } catch (e) {
        console.error(e);
        importError.value = t('product.import.error_parse', '文件解析失败');
    }
};

const handleConfirmMapping = () => {
    // Validate required
    if (!fieldMapping.value['name']) {
        addToast({ type: 'error', message: t('product.import.error_missing_fields', '请至少映射“商品名称”和“SKU”字段') });
        return;
    }

    const mappedData = rawFileRows.value.map(row => {
        const item = {};
        SYSTEM_FIELDS.forEach(field => {
            const headerName = fieldMapping.value[field.key];
            if (headerName) {
                const colIndex = fileHeaders.value.indexOf(headerName);
                if (colIndex !== -1) {
                    item[field.key] = row[colIndex];
                }
            }
        });
        Object.assign(item, extractInternalCodes(fileHeaders.value, row));
        // Default Status
        item.status = 'active';
        return item;
    }).filter(i => i.name);

    parsedItems.value = mappedData;

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

    loading.value = true;
    try {
        // Upload matched images
        // We do this one by one or batched.
        const matches = Array.from(imageMatches.value.entries());
        let uploadedCount = 0;
        
        for (const [key, file] of matches) {
            const formData = new FormData();
            formData.append('file', file);
            
            // Upload to API
            const res = await fetch(`${API.MANAGE_UPLOAD}?context=product`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
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
            }
        }
        
        addToast({ message: t('product.import.upload_success', { count: uploadedCount }), type: 'success' });
        currentStep.value = 4; // To Preview
        
    } catch (e) {
        console.error(e);
        addToast({ message: t('product.import.upload_failed', { message: e.message }), type: 'error' });
    } finally {
        loading.value = false;
    }
};

// Back to upload
const handleBack = () => {
    if (currentStep.value === 3) {
        resetFile();
    } else if (currentStep.value === 4) {
        // If came from 5, go back to 5? Or back to 3? 
        // Simplification: Go back to Mapping (3) resets matching?
        // Let's go back to 3.
        currentStep.value = 3;
        parsedItems.value = [];
    } else if (currentStep.value === 5) {
        currentStep.value = 3;
        parsedItems.value = [];
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
    errors: []
});

const handleImport = async () => {
    if (!parsedItems.value.length) return;
    
    loading.value = true;
    importError.value = null;
    importResult.value = null;
    
    // Reset stats
    _importStats.value = {
        processed: 0,
        total: parsedItems.value.length,
        success: 0,
        failed: 0,
        errors: []
    };
    
    try {
        const totalItems = parsedItems.value;
        const totalChunks = Math.ceil(totalItems.length / CHUNK_SIZE);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = start + CHUNK_SIZE;
            const chunk = totalItems.slice(start, end);
            
            try {
                const result = await importProducts(chunk);
                if (result.success) {
                    _importStats.value.success += (result.count || chunk.length);
                } else {
                    _importStats.value.failed += chunk.length;
                    const errorMsg = `Batch ${i+1} failed: ${result.error || 'Unknown error'}`;
                    _importStats.value.errors.push(errorMsg);
                    console.error(errorMsg, result);
                }
            } catch (e) {
                _importStats.value.failed += chunk.length;
                const errorMsg = `Batch ${i+1} Exception: ${e.message}`;
                _importStats.value.errors.push(errorMsg);
                console.error(errorMsg, e);
            }
            
            _importStats.value.processed += chunk.length;
        }

        // Final result construction
        const hasSuccess = _importStats.value.success > 0;
        importResult.value = {
            success: hasSuccess,
            count: _importStats.value.success,
            failed: _importStats.value.failed,
            errors: _importStats.value.errors
        };
        
        if (_importStats.value.failed > 0) {
             if (hasSuccess) {
                 addToast({ message: t('product.import.stats_summary', { success: _importStats.value.success, failed: _importStats.value.failed }), type: 'warning' });
             } else {
                 addToast({ message: t('product.import.stats.all_failed', { failed: _importStats.value.failed }, `导入失败: 全部 ${_importStats.value.failed} 条数据导入失败`), type: 'error' });
             }
        } else {
             addToast({ message: t('common.success'), type: 'success' });
             emit('success');
        }

    } catch (e) {
        importError.value = e.message;
    } finally {
        loading.value = false;
    }
};
</script>
