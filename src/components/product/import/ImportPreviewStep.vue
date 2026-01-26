<template>
    <div v-if="fileName" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4 dark:border-white/10 dark:bg-white/5">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="file-icon flex size-10 items-center justify-center rounded-lg bg-[var(--color-success)]/10 text-[var(--color-success-text)] dark:bg-[var(--color-success)]/20">
                    <svg class="size-6 text-[var(--color-success-text)]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                </div>
                <div>
                    <h4 class="text-sm font-medium text-[var(--text-main)]">{{ fileName }}</h4>
                    <p class="text-xs text-[var(--text-secondary)]">{{ fileSize }}</p>
                </div>
            </div>
            <button 
                class="text-[var(--text-muted)] hover:text-[var(--color-danger)]"
                @click="$emit('reset')"
            >
                <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <!-- Parsed Stats -->
        <div v-if="parsedItems.length > 0" class="mt-4 border-t border-[var(--border-color)] pt-3 dark:border-white/10">
            <div class="flex items-center justify-between text-sm">
                <span class="text-[var(--text-secondary)]">{{ t('product.import.total_rows', '识别行数') }}:</span>
                <span class="font-medium text-[var(--text-main)]">{{ parsedItems.length }}</span>
            </div>
            <div v-if="parsedItems.length > 500" class="mt-2 rounded bg-[var(--color-warning)]/10 px-2 py-1 text-xs text-[var(--color-warning-text)]">
                ⚠️ {{ t('product.import.limit_warning', '数据量较大，将自动分批导入') }}
            </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="loading" class="mt-4 border-t border-[var(--border-color)] pt-3 dark:border-white/10">
            <div class="mb-1 flex justify-between text-xs">
            <span class="text-[var(--color-primary)]">
                {{ t('product.import.importing', { current: importStats.processed, total: importStats.total }) }}
                ({{ Math.ceil(importStats.processed / chunkSize) }}/{{ Math.ceil(importStats.total / chunkSize) }} 批次)
            </span>
            <span class="font-medium text-[var(--text-main)] dark:text-white">
                {{ Math.round((importStats.processed / importStats.total) * 100) }}%
            </span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)] transition-colors dark:bg-white/10">
            <div 
                class="h-full bg-[var(--color-primary)] transition-all duration-300" 
                :style="{ width: (importStats.processed / importStats.total) * 100 + '%' }"
            ></div>
        </div>
        </div>
    </div>
    
    <!-- Import Result -->
    <div
v-if="importResult" class="mt-4 rounded-md p-3 text-sm" 
    :class="importResult.success && importResult.count > 0 ? 'bg-[var(--color-success)]/10 text-[var(--color-success-text)] dark:bg-[var(--color-success)]/10 dark:text-green-300' : 'bg-[var(--color-danger)]/10 text-[var(--color-danger-text)] dark:bg-[var(--color-danger)]/10 dark:text-red-300'">
        <p class="font-medium">
        {{ importResult.success && importResult.count > 0 ? '导入完成！' : '导入失败' }}
        </p>
        <ul class="mt-1 list-disc pl-4 text-xs">
            <li>成功: {{ importResult.count }}</li>
            <li v-if="importResult.failed > 0">失败: {{ importResult.failed }} (查看控制台获取详细日志)</li>
        </ul>
    </div>

    <!-- Error Feedback (General) -->
    <div v-if="importError" class="mt-4 rounded-md bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger-text)] dark:bg-[var(--color-danger)]/10 dark:text-red-300">
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
