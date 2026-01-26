<template>
    <div v-if="fileName" class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="file-icon bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 flex size-10 items-center justify-center rounded-lg">
                    <svg class="size-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                </div>
                <div>
                    <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ fileName }}</h4>
                    <p class="text-xs text-gray-500">{{ fileSize }}</p>
                </div>
            </div>
            <button 
                class="text-gray-400 hover:text-red-500"
                @click="$emit('reset')"
            >
                <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <!-- Parsed Stats -->
        <div v-if="parsedItems.length > 0" class="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
            <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-300">{{ t('product.import.total_rows', '识别行数') }}:</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ parsedItems.length }}</span>
            </div>
            <div class="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded dark:bg-amber-900/20 dark:text-amber-400" v-if="parsedItems.length > 500">
                ⚠️ {{ t('product.import.limit_warning', '数据量较大，将自动分批导入') }}
            </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="loading" class="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
            <div class="mb-1 flex justify-between text-xs">
            <span class="text-indigo-600 dark:text-indigo-400">
                {{ t('product.import.importing', { current: importStats.processed, total: importStats.total }) }}
                ({{ Math.ceil(importStats.processed / chunkSize) }}/{{ Math.ceil(importStats.total / chunkSize) }} 批次)
            </span>
            <span class="font-medium text-gray-700 dark:text-gray-300">
                {{ Math.round((importStats.processed / importStats.total) * 100) }}%
            </span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div 
                class="h-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-500" 
                :style="{ width: (importStats.processed / importStats.total) * 100 + '%' }"
            ></div>
        </div>
        </div>
    </div>
    
    <!-- Import Result -->
    <div v-if="importResult" class="rounded-md p-3 text-sm mt-4" 
    :class="importResult.success && importResult.count > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'">
        <p class="font-medium">
        {{ importResult.success && importResult.count > 0 ? '导入完成！' : '导入失败' }}
        </p>
        <ul class="mt-1 list-disc pl-4 text-xs">
            <li>成功: {{ importResult.count }}</li>
            <li v-if="importResult.failed > 0">失败: {{ importResult.failed }} (查看控制台获取详细日志)</li>
        </ul>
    </div>

    <!-- Error Feedback (General) -->
    <div v-if="importError" class="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300 mt-4">
        {{ importError }}
    </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';

defineProps({
    fileName: { type: String, default: '' },
    fileSize: { type: String, default: '' },
    parsedItems: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    importResult: { type: Object, default: null },
    importError: { type: String, default: null },
    importStats: { type: Object, default: () => ({ processed: 0, total: 0}) },
    chunkSize: {
        type: Number,
        default: 200
    }
});

defineEmits(['reset']);
const { t } = useI18n();
</script>
