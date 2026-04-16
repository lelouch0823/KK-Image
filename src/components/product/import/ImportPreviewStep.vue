<template>
    <div v-if="fileName" class="rounded-lg border border-(--border-color) bg-(--bg-card) p-4">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="bg-success/10 text-success flex size-10 items-center justify-center rounded-lg">
                    <AppIcon name="document-text" class="size-6" />
                </div>
                <div>
                    <h4 class="text-sm font-medium text-(--text-main)">{{ fileName }}</h4>
                    <p class="text-xs text-(--text-secondary)">{{ fileSize }}</p>
                </div>
            </div>
            <AppButton
                variant="ghost"
                size="sm"
                class="text-(--text-muted) hover:text-danger !h-8 !w-8 !gap-0 !px-0 [&_span]:hidden"
                @click="$emit('reset')"
            >
                <template #icon-left>
                    <AppIcon name="x-mark" class="size-5" />
                </template>
            </AppButton>
        </div>

        <!-- Parsed Stats -->
        <div v-if="parsedItems.length > 0" class="mt-4 border-t border-(--border-color) pt-3">
            <div class="flex items-center justify-between text-sm">
                <span class="text-(--text-secondary)">{{ t('product.import.total_rows', '识别行数') }}:</span>
                <span class="font-medium text-(--text-main)">{{ parsedItems.length }}</span>
            </div>

            <div v-if="showPreprocessStats" class="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div class="rounded-md border border-(--border-color) bg-(--bg-muted) px-2 py-1.5">
                    <p class="text-(--text-secondary)">{{ t('product.import.preprocess.source_rows', '源数据行') }}</p>
                    <p class="mt-1 font-semibold text-(--text-main)">{{ preprocessStats.sourceRows }}</p>
                </div>
                <div class="rounded-md border border-(--border-color) bg-(--bg-muted) px-2 py-1.5">
                    <p class="text-(--text-secondary)">{{ t('product.import.preprocess.accepted_rows', '可导入行') }}</p>
                    <p class="text-success mt-1 font-semibold">{{ preprocessStats.acceptedRows }}</p>
                </div>
                <div class="rounded-md border border-(--border-color) bg-(--bg-muted) px-2 py-1.5">
                    <p class="text-(--text-secondary)">{{ t('product.import.preprocess.dropped_rows', '过滤空行') }}</p>
                    <p class="text-warning mt-1 font-semibold">{{ preprocessStats.droppedEmptyRows }}</p>
                </div>
                <div class="rounded-md border border-(--border-color) bg-(--bg-muted) px-2 py-1.5">
                    <p class="text-(--text-secondary)">{{ t('product.import.preprocess.normalized_rows', '清洗归一化') }}</p>
                    <p class="text-primary mt-1 font-semibold">{{ preprocessStats.normalizedRows }}</p>
                </div>
            </div>
            
            <div v-if="hasSpu" class="bg-warning/10 text-warning mt-2 flex items-start gap-2 rounded px-2 py-1.5 text-xs">
                <AppIcon name="exclamation-triangle" class="mt-0.5 size-3 shrink-0" />
                <span>{{ t('product.import.spu_update_warning', '检测到相同 SPU 将更新原有商品及变体数据') }}</span>
            </div>
            
            <div v-if="parsedItems.length > 500" class="bg-warning/10 text-warning mt-2 rounded px-2 py-1 text-xs">
                {{ t('product.import.limit_warning', '数据量较大，将自动分批导入') }}
            </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="loading" class="mt-4 border-t border-(--border-color) pt-3">
            <div class="mb-1 flex justify-between text-xs">
            <span class="text-primary">
                {{ t('product.import.importing', { current: importStats.processed, total: importStats.total }) }}
                ({{ processedChunk }}/{{ totalChunk }} 批次)
            </span>
            <span class="font-medium text-(--text-main)">
                {{ progressPercent }}%
            </span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-(--bg-muted) transition-colors">
            <div 
                class="bg-primary h-full transition-all duration-300" 
                :style="{ width: progressPercent + '%' }"
            ></div>
        </div>
        </div>
    </div>
    
    <!-- Import Result -->
    <div
      v-if="importResult" class="mt-4 rounded-md p-3 text-sm" 
      :class="importResult.success && importResult.count > 0 ? 'bg-(--color-success-bg) text-(--color-success-text)' : 'bg-(--color-danger-bg) text-(--color-danger-text)'">
        <p class="font-medium">
        {{ importResult.success && importResult.count > 0 ? '导入完成！' : '导入失败' }}
        </p>
        <ul class="mt-2 list-disc space-y-1 pl-4 text-xs">
            <template v-if="importResult.summary">
                <li v-if="importResult.summary.createdProducts">{{ t('product.import.stats.created_products', '新建商品') }}: {{ importResult.summary.createdProducts }}</li>
                <li v-if="importResult.summary.updatedProducts">{{ t('product.import.stats.updated_products', '更新商品') }}: {{ importResult.summary.updatedProducts }}</li>
                <li v-if="importResult.summary.createdVariants">{{ t('product.import.stats.created_variants', '新建变体') }}: {{ importResult.summary.createdVariants }}</li>
                <li v-if="importResult.summary.updatedVariants">{{ t('product.import.stats.updated_variants', '更新变体') }}: {{ importResult.summary.updatedVariants }}</li>
                <li v-if="importResult.summary.conflicts">{{ t('product.import.stats.conflicts', '冲突并跳过') }}: {{ importResult.summary.conflicts }}</li>
            </template>
            <li v-else>成功: {{ importResult.count }}</li>
            <li v-if="importResult.failed > 0" class="text-danger mt-1">失败: {{ importResult.failed }} (查看控制台获取详细日志)</li>
        </ul>
    </div>

    <div
        v-if="importResult && Array.isArray(importResult.conflicts) && importResult.conflicts.length > 0"
        class="border-warning/30 bg-warning/10 mt-3 rounded-md border p-3"
    >
        <div class="mb-2 flex items-center justify-between">
            <p class="text-warning text-sm font-semibold">{{ t('product.import.conflicts.title', '冲突详情（已跳过）') }}</p>
            <div class="flex items-center gap-2">
                <AppButton variant="ghost" size="sm" @click="downloadConflictsCsv">
                    {{ t('product.import.conflicts.download', '下载冲突报告 CSV') }}
                </AppButton>
                <AppButton variant="ghost" size="sm" @click="toggleConflictsExpanded">
                    {{ conflictsExpanded ? t('common.collapse', '收起') : t('common.expand', '展开') }}
                </AppButton>
            </div>
        </div>

        <div v-if="conflictsExpanded" class="space-y-2">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <AppInput
                    v-model="conflictSearch"
                    data-testid="conflict-search-input"
                    size="sm"
                    :placeholder="t('product.import.conflicts.search_placeholder', '搜索 SPU/SKU/字段')"
                />
                <Select
                    data-testid="conflict-level-select"
                    :model-value="conflictLevelFilter"
                    :options="conflictLevelOptions"
                    size="sm"
                    @update:model-value="conflictLevelFilter = $event"
                />
                <AppButton
                    variant="ghost"
                    size="sm"
                    data-testid="copy-visible-conflicts"
                    class="justify-self-start"
                    @click="copyVisibleConflicts"
                >
                    {{ t('product.import.conflicts.copy_visible', '复制当前结果') }}
                </AppButton>
            </div>

            <div class="border-warning/20 max-h-52 overflow-y-auto rounded border bg-(--bg-card)">
                <table class="w-full table-fixed text-xs">
                    <thead class="bg-(--bg-muted)">
                        <tr>
                            <th class="px-2 py-1 text-left font-semibold">{{ t('product.import.conflicts.col_level', '层级') }}</th>
                            <th class="px-2 py-1 text-left font-semibold">SPU</th>
                            <th class="px-2 py-1 text-left font-semibold">SKU</th>
                            <th class="px-2 py-1 text-left font-semibold">{{ t('product.import.conflicts.col_field', '字段') }}</th>
                            <th class="px-2 py-1 text-left font-semibold">{{ t('product.import.conflicts.col_current', '原值') }}</th>
                            <th class="px-2 py-1 text-left font-semibold">{{ t('product.import.conflicts.col_incoming', '导入值') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(conflict, idx) in visibleConflicts"
                            :key="`conflict-row-${idx}`"
                            class="border-b border-(--border-color) last:border-b-0"
                        >
                            <td class="px-2 py-1">{{ conflict.level || '-' }}</td>
                            <td class="px-2 py-1">{{ conflict.spu || '-' }}</td>
                            <td class="px-2 py-1">{{ conflict.sku || '-' }}</td>
                            <td class="text-warning px-2 py-1">{{ conflict.field || '-' }}</td>
                            <td class="truncate px-2 py-1" :title="String(conflict.current ?? '-')">{{ String(conflict.current ?? '-') }}</td>
                            <td class="truncate px-2 py-1" :title="String(conflict.incoming ?? '-')">{{ String(conflict.incoming ?? '-') }}</td>
                        </tr>
                        <tr v-if="visibleConflicts.length === 0">
                            <td colspan="6" class="px-2 py-3 text-center text-(--text-secondary)">
                                {{ t('product.import.conflicts.empty_filtered', '无匹配冲突') }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Error Feedback (General) -->
    <div v-if="importError" class="mt-4 rounded-md bg-(--color-danger-bg) p-3 text-sm text-(--color-danger-text)">
        {{ importError }}
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import Select from '@/components/ui/Select.vue';

const props = defineProps({
    fileName: { type: String, default: '' },
    fileSize: { type: String, default: '' },
    parsedItems: { type: Array, default: () => [] },
    preprocessStats: {
        type: Object,
        default: () => ({ sourceRows: 0, acceptedRows: 0, droppedEmptyRows: 0, normalizedRows: 0 })
    },
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
const { copy } = useClipboard();

const hasSpu = computed(() => {
    if (!Array.isArray(props.parsedItems) || props.parsedItems.length === 0) return false;
    const counts = new Map();
    props.parsedItems.forEach((item) => {
        const spu = String(item?.spu || '').trim();
        if (!spu) return;
        counts.set(spu, (counts.get(spu) || 0) + 1);
    });
    return Array.from(counts.values()).some((count) => count > 1);
});

const showPreprocessStats = computed(() => (
    Number(props.preprocessStats?.sourceRows || 0) > 0
));
const conflictsExpanded = ref(true);
const conflictSearch = ref('');
const conflictLevelFilter = ref('all');
const conflictLevelOptions = computed(() => [
    { value: 'all', label: t('product.import.conflicts.level_all', '全部层级') },
    { value: 'product', label: t('product.import.conflicts.level_product', '商品层') },
    { value: 'variant', label: t('product.import.conflicts.level_variant', '变体层') },
]);
const progressPercent = computed(() => {
    const total = Number(props.importStats?.total || 0);
    if (total <= 0) return 0;
    const processed = Number(props.importStats?.processed || 0);
    return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
});
const totalChunk = computed(() => {
    const total = Number(props.importStats?.total || 0);
    if (total <= 0) return 1;
    return Math.max(1, Math.ceil(total / Number(props.chunkSize || 1)));
});
const processedChunk = computed(() => {
    const processed = Number(props.importStats?.processed || 0);
    if (processed <= 0) return 0;
    return Math.min(totalChunk.value, Math.ceil(processed / Number(props.chunkSize || 1)));
});

const csvEscape = (value) => {
    const raw = String(value ?? '');
    if (!/[",\n]/.test(raw)) return raw;
    return `"${raw.replace(/"/g, '""')}"`;
};

const downloadConflictsCsv = () => {
    const rows = Array.isArray(props.importResult?.conflicts) ? props.importResult.conflicts : [];
    if (rows.length === 0) return;
    const header = ['batch', 'level', 'spu', 'sku', 'field', 'current', 'incoming'];
    const lines = [header.join(',')];
    rows.forEach((row) => {
        lines.push(header.map((key) => csvEscape(row?.[key])).join(','));
    });
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `import-conflicts-${Date.now()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

const toggleConflictsExpanded = () => {
    conflictsExpanded.value = !conflictsExpanded.value;
};

const normalizedConflictSearch = computed(() => String(conflictSearch.value || '').trim().toLowerCase());
const visibleConflicts = computed(() => {
    const rows = Array.isArray(props.importResult?.conflicts) ? props.importResult.conflicts : [];
    return rows
        .filter((row) => conflictLevelFilter.value === 'all' || String(row?.level || '') === conflictLevelFilter.value)
        .filter((row) => {
            if (!normalizedConflictSearch.value) return true;
            const haystack = [
                row?.spu,
                row?.sku,
                row?.field,
                row?.current,
                row?.incoming,
                row?.level,
            ].map((v) => String(v ?? '').toLowerCase()).join(' ');
            return haystack.includes(normalizedConflictSearch.value);
        })
        .slice(0, 200);
});

const copyText = async (text) => {
    const payload = String(text || '');
    if (!payload) return;
    await copy(payload, {
        successMessage: t('common.copied'),
        errorMessage: t('common.copyFailed'),
    });
};

const copyVisibleConflicts = async () => {
    const lines = visibleConflicts.value.map((row) => (
        `[${row.level || '-'}] SPU=${row.spu || '-'} SKU=${row.sku || '-'} ${row.field || '-'}: ${row.current ?? '-'} -> ${row.incoming ?? '-'}`
    ));
    await copyText(lines.join('\n'));
};
</script>
