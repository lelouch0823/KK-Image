<template>
    <div>
        <h3 class="mb-2 text-lg font-semibold text-(--text-main)">{{ t('product.import.mapping_title', '列名映射') }}</h3>
        <p class="mb-4 text-sm text-(--text-secondary)">{{ t('product.import.mapping_desc', '请确认文件列与系统字段的对应关系') }}</p>
        <div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="rounded-lg border border-(--border-color) bg-(--bg-muted) px-3 py-2">
                <p class="text-xs text-(--text-secondary)">{{ t('product.import.meta.headers', '检测到列') }}</p>
                <p class="mt-1 text-sm font-semibold text-(--text-main)">{{ fileHeaders.length }}</p>
            </div>
            <div class="rounded-lg border border-(--border-color) bg-(--bg-muted) px-3 py-2">
                <p class="text-xs text-(--text-secondary)">{{ t('product.import.meta.fields', '系统字段') }}</p>
                <p class="mt-1 text-sm font-semibold text-(--text-main)">{{ systemFields.length }}</p>
            </div>
            <div class="rounded-lg border border-(--border-color) bg-(--bg-muted) px-3 py-2">
                <p class="text-xs text-(--text-secondary)">{{ t('product.import.meta.required', '必填字段') }}</p>
                <p class="mt-1 text-sm font-semibold text-(--text-main)">{{ requiredCount }}</p>
            </div>
            <div class="rounded-lg border border-(--border-color) bg-(--bg-muted) px-3 py-2">
                <p class="text-xs text-(--text-secondary)">{{ t('product.import.meta.mapped', '已映射') }}</p>
                <p class="text-primary mt-1 text-sm font-semibold">{{ mappedCount }}</p>
            </div>
        </div>
        <div class="grid max-h-[40vh] grid-cols-1 gap-4 overflow-y-auto pr-1">
            <div v-for="field in systemFields" :key="field.key" class="flex items-center justify-between border-b border-(--border-color) pb-2">
                <div class="flex flex-col">
                    <span class="text-sm font-medium text-(--text-main)">
                        {{ field.label }} 
                        <span v-if="field.required" class="text-danger">*</span>
                    </span>
                    <span class="text-xs text-(--text-secondary)">Field: {{ field.key }}</span>
                </div>
                <div class="w-1/2">
                    <Select
                        :model-value="modelValue[field.key]"
                        :options="[{label: t('product.import.ignore', '忽略 (Ignore)'), value: ''}, ...fileHeaders.map(h => ({label: h, value: h}))]"
                        placeholder="选择对应列"
                        @update:model-value="updateMapping(field.key, $event)"
                    />
                </div>
            </div>
        </div>

        <div class="mt-5 rounded-xl border border-(--border-color) bg-(--bg-muted) p-4">
            <div class="mb-3 flex items-center justify-between">
                <div>
                    <h4 class="text-sm font-semibold text-(--text-main)">{{ t('product.import.specs.title', '规格配置') }}</h4>
                    <p class="mt-1 text-xs text-(--text-secondary)">
                        {{ t('product.import.specs.desc', '支持 0-3 个规格，支持预设名称或自定义名称。') }}
                    </p>
                </div>
                <AppButton
                    variant="ghost"
                    size="sm"
                    :disabled="specConfigs.length >= 3"
                    @click="addSpec"
                >
                    + {{ t('product.import.specs.add', '添加规格') }}
                </AppButton>
            </div>

            <div v-if="specConfigs.length === 0" class="text-xs text-(--text-secondary)">
                {{ t('product.import.specs.empty', '未配置规格，将按无规格导入。') }}
            </div>

            <div v-for="(spec, index) in specConfigs" :key="spec.id || index" class="mb-3 rounded-lg border border-(--border-color) bg-(--bg-card) p-3 last:mb-0">
                <div class="mb-2 flex items-center justify-between">
                    <span class="text-xs font-semibold text-(--text-main)">
                        {{ t('product.import.specs.item', '规格') }} {{ index + 1 }}
                    </span>
                    <AppButton
                        variant="link"
                        size="sm"
                        class="text-danger"
                        :aria-label="t('common.delete', '删除')"
                        @click="removeSpec(index)"
                    >
                        {{ t('common.delete', '删除') }}
                    </AppButton>
                </div>

                <div class="mb-2 flex flex-wrap gap-2">
                    <AppButton
                        v-for="preset in getPresetOptionsFor(index)"
                        :key="preset"
                        :variant="normalizeName(spec.name) === normalizeName(preset) ? 'secondary' : 'ghost'"
                        size="sm"
                        class="rounded-full !px-2"
                        :class="normalizeName(spec.name) === normalizeName(preset) ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary' : ''"
                        @click="setSpecName(index, preset)"
                    >
                        {{ preset }}
                    </AppButton>
                </div>

                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <AppInput
                        :data-testid="`product-import-spec-name-${index}`"
                        :model-value="spec.name"
                        size="sm"
                        :placeholder="t('product.import.specs.name_placeholder', '输入规格名（如：颜色）')"
                        @update:model-value="setSpecName(index, $event)"
                    />
                    <Select
                        :data-testid="`product-import-spec-column-${index}`"
                        :model-value="spec.column"
                        :options="[{label: t('product.import.specs.select_column', '选择规格列'), value: ''}, ...fileHeaders.map(h => ({label: h, value: h}))]"
                        :placeholder="t('product.import.specs.select_column', '选择规格列')"
                        @update:model-value="setSpecColumn(index, $event)"
                    />
                </div>
            </div>
        </div>

        <div class="mt-4 rounded-xl border border-(--border-color) bg-(--bg-muted) p-4">
            <h4 class="text-sm font-semibold text-(--text-main)">{{ t('product.import.mode.title', '导入策略') }}</h4>
            <p class="mt-1 text-xs text-(--text-secondary)">
                {{ t('product.import.mode.desc', '请选择导入时遇到同 SPU/变体时的处理方式。') }}
            </p>
            <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <AppCard
                    clickable
                    data-testid="product-import-mode-safe-merge"
                    :selected="importMode === 'safe_merge'"
                    class="text-left"
                    padding="p-3"
                    @click="updateImportMode('safe_merge')"
                >
                    <p class="text-sm font-semibold">{{ t('product.import.mode.safe_merge', '仅更新无冲突（推荐）') }}</p>
                    <p class="mt-1 text-xs text-(--text-secondary)">{{ t('product.import.mode.safe_merge_desc', '已有非空且不一致字段将跳过，并记录冲突') }}</p>
                </AppCard>
                <AppCard
                    clickable
                    data-testid="product-import-mode-replace"
                    :selected="importMode === 'replace'"
                    class="text-left"
                    padding="p-3"
                    @click="updateImportMode('replace')"
                >
                    <p class="text-sm font-semibold">{{ t('product.import.mode.replace', '全覆盖更新') }}</p>
                    <p class="mt-1 text-xs text-(--text-secondary)">{{ t('product.import.mode.replace_desc', '同 SPU 命中后按导入值覆盖原有字段') }}</p>
                </AppCard>
            </div>
        </div>

        <div
            v-if="validationReport && validationReport.total > 0"
            class="border-warning/30 bg-warning/10 mt-4 rounded-xl border p-4"
        >
            <div class="mb-2 flex items-center justify-between">
                <h4 class="text-warning text-sm font-semibold">
                    {{ t('product.import.preprocess.report_title', '预清洗报告') }}
                </h4>
                <span class="text-warning text-xs font-medium">
                    {{ t('product.import.preprocess.report_total', { count: validationReport.total }, '共 {count} 个问题') }}
                </span>
            </div>
            <div class="mb-3 flex flex-wrap gap-2 text-xs">
                <span class="border-warning/30 rounded-full border px-2 py-1">
                    {{ t('product.import.preprocess.issue.missing_name', '商品名称为空') }}: {{ validationReport.byCode?.missing_name || 0 }}
                </span>
                <span class="border-warning/30 rounded-full border px-2 py-1">
                    {{ t('product.import.preprocess.issue.missing_sku', 'SKU 为空') }}: {{ validationReport.byCode?.missing_sku || 0 }}
                </span>
                <span class="border-warning/30 rounded-full border px-2 py-1">
                    {{ t('product.import.preprocess.issue.duplicate_sku', 'SKU 重复') }}: {{ validationReport.byCode?.duplicate_sku || 0 }}
                </span>
                <span class="border-warning/30 rounded-full border px-2 py-1">
                    {{ t('product.import.preprocess.issue.empty_row', '整行为空或仅包含默认值') }}: {{ validationReport.byCode?.empty_row || 0 }}
                </span>
            </div>
            <div class="border-warning/20 max-h-40 overflow-y-auto rounded-lg border bg-(--bg-card) p-2">
                <div
                    v-for="(issue, idx) in validationReport.samples || []"
                    :key="`${issue.code}-${issue.row}-${idx}`"
                    class="flex items-center justify-between border-b border-(--border-color) py-1 text-xs text-(--text-main) last:border-b-0"
                >
                    <span>{{ t('product.import.preprocess.row', { row: issue.row }, '第 {row} 行') }}</span>
                    <span class="text-warning">{{ issue.message }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppInput from '@/components/ui/AppInput.vue';
import Select from '@/components/ui/Select.vue';

const props = defineProps({
    modelValue: {
        type: Object,
        required: true
    },
    fileHeaders: {
        type: Array,
        required: true
    },
    systemFields: {
        type: Array,
        required: true
    },
    specConfigs: {
        type: Array,
        default: () => []
    },
    validationReport: {
        type: Object,
        default: null
    },
    importMode: {
        type: String,
        default: 'safe_merge'
    }
});

const emit = defineEmits(['update:modelValue', 'update:specConfigs', 'update:importMode']);
const { t } = useI18n();

const SPEC_PRESETS = computed(() => ([
    t('order.form.color', '颜色'),
    t('order.form.size', '尺寸'),
    t('order.form.material', '材质'),
]));

const normalizeName = (value) => String(value || '').trim().toLowerCase();
const requiredCount = computed(() => props.systemFields.filter((field) => field.required).length);
const mappedCount = computed(() => Object.values(props.modelValue || {}).filter(Boolean).length);

const updateMapping = (key, value) => {
    const newValue = { ...props.modelValue, [key]: value };
    emit('update:modelValue', newValue);
};

const updateSpecs = (next) => {
    emit('update:specConfigs', next);
};

const addSpec = () => {
    if (props.specConfigs.length >= 3) return;
    const next = [...props.specConfigs, { id: `spec-${Date.now()}-${props.specConfigs.length}`, name: '', column: '' }];
    updateSpecs(next);
};

const removeSpec = (index) => {
    const next = props.specConfigs.filter((_, i) => i !== index);
    updateSpecs(next);
};

const setSpecName = (index, name) => {
    const next = props.specConfigs.map((spec, i) => (i === index ? { ...spec, name } : spec));
    updateSpecs(next);
};

const setSpecColumn = (index, column) => {
    const next = props.specConfigs.map((spec, i) => (i === index ? { ...spec, column } : spec));
    updateSpecs(next);
};

const updateImportMode = (mode) => {
    emit('update:importMode', mode);
};

const getPresetOptionsFor = (index) => {
    const selected = new Set(
        props.specConfigs
            .map((spec, i) => (i === index ? '' : normalizeName(spec.name)))
            .filter(Boolean)
    );
    return SPEC_PRESETS.value.filter((preset) => !selected.has(normalizeName(preset)) || normalizeName(props.specConfigs[index]?.name) === normalizeName(preset));
};
</script>
