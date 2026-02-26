<template>
    <div class="space-y-6">
        <!-- 1. Download Template Step -->
        <div class="bg-primary/10 rounded-lg p-4">
            <h3 class="text-primary mb-2 text-sm font-medium">
                {{ t('product.import.step1_title', '第一步：下载模板') }}
            </h3>
            <p class="text-(--text-secondary) mb-3 text-xs">
                {{ t('product.import.step1_desc', '请下载标准 Excel 模板，按照格式填写商品信息。') }}
            </p>
            <button 
                type="button"
                class="bg-(--bg-card) hover:bg-(--bg-hover) text-primary inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium shadow-sm transition-colors"
                @click="downloadTemplate"
            >
                <AppIcon name="arrow-down-tray" class="size-4" />
                {{ t('product.import.download_template', '下载 Excel 模板') }}
            </button>
        </div>

        <!-- 2. Upload Area -->
        <div>
            <h3 class="text-(--text-main) mb-2 text-sm font-medium">
                {{ t('product.import.step2_title', '第二步：上传文件') }}
            </h3>
            <div 
                class="border-(--border-color) bg-(--bg-muted) hover:bg-(--bg-hover) relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors"
                :class="{ 'border-primary bg-primary/10': isDragOver }"
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
                    <AppIcon name="cloud-arrow-up" class="text-(--text-muted) mx-auto size-12" />
                    <p class="text-(--text-secondary) mt-2 text-sm">
                        <span class="text-primary font-medium hover:opacity-80">
                            {{ t('common.click_to_upload', '点击上传') }}
                        </span>
                        {{ t('common.or_drag_drop', '或拖拽文件到此处') }}
                    </p>
                    <p class="text-(--text-muted) mt-1 text-xs">
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
import AppIcon from '@/components/ui/AppIcon.vue';

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
