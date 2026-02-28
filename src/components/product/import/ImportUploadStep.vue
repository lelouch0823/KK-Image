<template>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-1">
            <div class="rounded-xl border border-primary/30 bg-primary/8 p-4">
                <h3 class="text-primary mb-1 text-sm font-semibold">
                    {{ t('product.import.step1_title', '第一步：下载模板') }}
                </h3>
                <p class="text-(--text-secondary) mb-3 text-xs leading-5">
                    {{ t('product.import.step1_desc', '请下载标准 Excel 模板，按照格式填写商品信息。') }}
                </p>
                <button 
                    type="button"
                    class="bg-(--bg-card) hover:bg-(--bg-hover) text-primary inline-flex cursor-pointer items-center gap-2 rounded-md border border-primary/20 px-3 py-1.5 text-xs font-medium shadow-sm transition-colors"
                    @click="downloadTemplate"
                >
                    <AppIcon name="arrow-down-tray" class="size-4" />
                    {{ t('product.import.download_template', '下载 Excel 模板') }}
                </button>
            </div>

            <div class="rounded-xl border border-(--border-color) bg-(--bg-muted) p-4">
                <p class="text-(--text-main) mb-2 text-xs font-semibold">{{ t('product.import.upload_rules', '导入建议') }}</p>
                <ul class="space-y-2 text-xs">
                    <li class="flex items-center gap-2 text-(--text-secondary)">
                        <AppIcon name="check-circle" class="text-success size-4" />
                        <span>{{ t('product.import.upload_rule_name_sku', '商品名称、SKU 必填') }}</span>
                    </li>
                    <li class="flex items-center gap-2 text-(--text-secondary)">
                        <AppIcon name="check-circle" class="text-success size-4" />
                        <span>{{ t('product.import.upload_rule_spu', '同 SPU 会视为同一商品') }}</span>
                    </li>
                    <li class="flex items-center gap-2 text-(--text-secondary)">
                        <AppIcon name="check-circle" class="text-success size-4" />
                        <span>{{ t('product.import.upload_rule_formats', '支持 .xlsx / .xls / .csv') }}</span>
                    </li>
                </ul>
            </div>
        </div>

        <div class="lg:col-span-2">
            <h3 class="text-(--text-main) mb-2 text-sm font-medium">
                {{ t('product.import.step2_title', '第二步：上传文件') }}
            </h3>
            <div 
                class="relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors"
                :class="isDragOver ? 'border-primary bg-primary/10' : 'border-(--border-color) bg-(--bg-muted) hover:bg-(--bg-hover)'"
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
                    <div class="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
                        <AppIcon name="cloud-arrow-up" class="text-primary size-7" />
                    </div>
                    <p class="text-(--text-main) text-sm font-medium">
                        <span class="text-primary">
                            {{ t('common.click_to_upload', '点击上传') }}
                        </span>
                        {{ t('common.or_drag_drop', '或拖拽文件到此处') }}
                    </p>
                    <p class="text-(--text-secondary) mt-1 text-xs">
                        {{ t('product.import.file_limits', '支持 .xlsx, .csv 格式') }}
                    </p>
                    <div class="mt-4 inline-flex items-center gap-2 rounded-full border border-(--border-color) bg-(--bg-card) px-3 py-1 text-[11px] text-(--text-secondary)">
                        <AppIcon name="shield-check" class="size-3.5 text-success" />
                        {{ t('product.import.upload_security', '文件仅用于本次导入，不会公开') }}
                    </div>
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
