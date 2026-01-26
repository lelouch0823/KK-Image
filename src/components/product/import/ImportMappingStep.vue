<template>
    <div>
        <h3 class="font-medium text-lg mb-4 dark:text-gray-100">{{ t('product.import.mapping_title', '列名映射') }}</h3>
        <p class="text-sm text-gray-500 mb-4 dark:text-gray-400">{{ t('product.import.mapping_desc', '请确认文件列与系统字段的对应关系') }}</p>
        <div class="grid grid-cols-1 gap-4 max-h-[50vh] overflow-y-auto pr-1">
            <div v-for="field in systemFields" :key="field.key" class="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-700">
                <div class="flex flex-col">
                    <span class="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {{ field.label }} 
                        <span v-if="field.required" class="text-red-500">*</span>
                    </span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">Field: {{ field.key }}</span>
                </div>
                <div class="w-1/2">
                    <Select
                        :model-value="modelValue[field.key]"
                        @update:model-value="updateMapping(field.key, $event)"
                        :options="[{label: t('product.import.ignore', '忽略 (Ignore)'), value: ''}, ...fileHeaders.map(h => ({label: h, value: h}))]"
                        placeholder="选择对应列"
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
