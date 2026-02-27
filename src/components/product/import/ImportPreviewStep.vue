<template>
    <div v-if="fileName" class="border-(--border-color) bg-(--bg-card) dark:border-white/10 dark:bg-white/5 rounded-lg border p-4">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="bg-success/10 text-success dark:bg-success/20 flex size-10 items-center justify-center rounded-lg">
                    <AppIcon name="document-text" class="size-6" />
                </div>
                <div>
                    <h4 class="text-(--text-main) text-sm font-medium">{{ fileName }}</h4>
                    <p class="text-(--text-secondary) text-xs">{{ fileSize }}</p>
                </div>
            </div>
            <button 
                class="text-(--text-muted) hover:text-danger cursor-pointer"
                @click="$emit('reset')"
            >
                <AppIcon name="x-mark" class="size-5" />
            </button>
        </div>

        <!-- Parsed Stats -->
        <div v-if="parsedItems.length > 0" class="border-(--border-color) dark:border-white/10 mt-4 border-t pt-3">
            <div class="flex items-center justify-between text-sm">
                <span class="text-(--text-secondary)">{{ t('product.import.total_rows', '识别行数') }}:</span>
                <span class="text-(--text-main) font-medium">{{ parsedItems.length }}</span>
            </div>
            
            <div v-if="hasSpu" class="bg-warning/10 text-warning mt-2 flex items-start gap-2 rounded px-2 py-1.5 text-xs">
                <AppIcon name="exclamation-triangle" class="mt-0.5 size-3 shrink-0" />
                <span>{{ t('product.import.spu_update_warning', '检测到相同 SPU 将更新原有商品及变体数据') }}</span>
            </div>
            
            <div v-if="parsedItems.length > 500" class="bg-warning/10 text-warning mt-2 rounded px-2 py-1 text-xs">
                ⚠️ {{ t('product.import.limit_warning', '数据量较大，将自动分批导入') }}
            </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="loading" class="border-(--border-color) dark:border-white/10 mt-4 border-t pt-3">
            <div class="mb-1 flex justify-between text-xs">
            <span class="text-primary">
                {{ t('product.import.importing', { current: importStats.processed, total: importStats.total }) }}
                ({{ Math.ceil(importStats.processed / chunkSize) }}/{{ Math.ceil(importStats.total / chunkSize) }} 批次)
            </span>
            <span class="text-(--text-main) font-medium dark:text-white">
                {{ Math.round((importStats.processed / importStats.total) * 100) }}%
            </span>
        </div>
        <div class="bg-(--bg-muted) dark:bg-white/10 h-2 w-full overflow-hidden rounded-full transition-colors">
            <div 
                class="bg-primary h-full transition-all duration-300" 
                :style="{ width: (importStats.processed / importStats.total) * 100 + '%' }"
            ></div>
        </div>
        </div>
    </div>
    
    <!-- Import Result -->
    <div
      v-if="importResult" class="mt-4 rounded-md p-3 text-sm" 
      :class="importResult.success && importResult.count > 0 ? 'bg-success/10 text-success dark:bg-success/10 dark:text-green-300' : 'bg-danger/10 text-danger dark:bg-danger/10 dark:text-red-300'">
        <p class="font-medium">
        {{ importResult.success && importResult.count > 0 ? '导入完成！' : '导入失败' }}
        </p>
        <ul class="mt-1 list-disc pl-4 text-xs">
            <li>成功: {{ importResult.count }}</li>
            <li v-if="importResult.failed > 0">失败: {{ importResult.failed }} (查看控制台获取详细日志)</li>
        </ul>
    </div>

    <!-- Error Feedback (General) -->
    <div v-if="importError" class="bg-danger/10 text-danger dark:bg-danger/10 mt-4 rounded-md p-3 text-sm dark:text-red-300">
        {{ importError }}
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
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

const hasSpu = computed(() => {
    return props.parsedItems && props.parsedItems.some(item => !!item.spu);
});
</script>
