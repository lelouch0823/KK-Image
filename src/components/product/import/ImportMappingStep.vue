<template>
    <div>
        <h3 class="mb-4 text-lg font-medium text-[var(--text-main)]">{{ t('product.import.mapping_title', '列名映射') }}</h3>
        <p class="mb-4 text-sm text-[var(--text-secondary)]">{{ t('product.import.mapping_desc', '请确认文件列与系统字段的对应关系') }}</p>
        <div class="grid max-h-[50vh] grid-cols-1 gap-4 overflow-y-auto pr-1">
            <div v-for="field in systemFields" :key="field.key" class="flex items-center justify-between border-b border-[var(--border-color)] pb-2 dark:border-white/10">
                <div class="flex flex-col">
                    <span class="text-sm font-medium text-[var(--text-main)] dark:text-white">
                        {{ field.label }} 
                        <span v-if="field.required" class="text-[var(--color-danger)]">*</span>
                    </span>
                    <span class="text-xs text-[var(--text-secondary)]">Field: {{ field.key }}</span>
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
    </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
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
    }
});

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const updateMapping = (key, value) => {
    const newValue = { ...props.modelValue, [key]: value };
    emit('update:modelValue', newValue);
};
</script>
