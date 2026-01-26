<template>
    <div class="space-y-6">
        <!-- 1. Download Template Step -->
        <div class="rounded-lg bg-indigo-50 p-4 dark:bg-indigo-900/20">
            <h3 class="mb-2 text-sm font-medium text-indigo-900 dark:text-indigo-200">
                {{ t('product.import.step1_title', '第一步：下载模板') }}
            </h3>
            <p class="mb-3 text-xs text-indigo-700 dark:text-indigo-300">
                {{ t('product.import.step1_desc', '请下载标准 Excel 模板，按照格式填写商品信息。') }}
            </p>
            <button 
                type="button"
                class="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm hover:bg-indigo-50 dark:bg-indigo-900 dark:text-indigo-200 dark:hover:bg-indigo-800"
                @click="downloadTemplate"
            >
                <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {{ t('product.import.download_template', '下载 Excel 模板') }}
            </button>
        </div>

        <!-- 2. Upload Area -->
        <div>
            <h3 class="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ t('product.import.step2_title', '第二步：上传文件') }}
            </h3>
            <div 
                class="relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                :class="{ 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10': isDragOver }"
                @dragover.prevent="isDragOver = true"
                @dragleave.prevent="isDragOver = false"
                @drop.prevent="handleDrop"
                @click="$refs.fileInput.click()"
            >
                <input 
                    ref="fileInput"
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    class="hidden"
                    @change="handleFileSelect"
                >
                
                <div class="text-center">
                    <svg class="mx-auto size-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        <span class="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                            {{ t('common.click_to_upload', '点击上传') }}
                        </span>
                        {{ t('common.or_drag_drop', '或拖拽文件到此处') }}
                    </p>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {{ t('product.import.file_limits', '支持 .xlsx, .csv 格式') }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import * as XLSX from 'xlsx';

const emit = defineEmits(['file-selected']);
const { t } = useI18n();

const isDragOver = ref(false);
const fileInput = ref(null);

// --- Template Download ---
const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
        { name: 'Example Product', sku: 'SKU-001', price: 99.00, stock_quantity: 100, image_url: 'https://example.com/img.jpg', description: 'Optional desc' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "product_template.xlsx");
};

const handleFileSelect = (e) => {
    emit('file-selected', e.target.files[0]);
    // Reset input so same file can be selected again if needed (though usually we proceed to next step)
    if (fileInput.value) fileInput.value.value = ''; 
};

const handleDrop = (e) => {
    isDragOver.value = false;
    emit('file-selected', e.dataTransfer.files[0]);
};
</script>
