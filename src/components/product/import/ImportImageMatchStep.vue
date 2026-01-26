<template>
    <div>
        <h3 class="mb-2 text-lg font-medium dark:text-gray-100">{{ t('product.import.step_image', '图片智能匹配') }}</h3>
        <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
            检测到Excel中包含 {{ totalImagesCount }} 个本地图片引用。请上传对应的图片文件。
        </p>

        <!-- Dropzone -->
        <div 
            class="relative mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
            :class="{ 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave.prevent="isDragOver = false"
            @drop.prevent="handleDrop"
            @click="$refs.imageUploadInput.click()"
        >
            <input 
                ref="imageUploadInput"
                type="file" 
                accept="image/*" 
                multiple
                class="hidden"
                @change="handleSelect"
            >
            <div class="text-center">
                <svg class="mx-auto size-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    <span class="font-medium text-indigo-600 hover:text-indigo-500">点击选择图片</span>
                    (支持批量/拖拽)
                </p>
                <p class="mt-1 text-xs text-gray-500">已选择 {{ fileCount }} 个文件</p>
            </div>
        </div>

        <!-- Match Stats -->
        <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div class="mb-3 flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">匹配结果</span>
                <span class="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    {{ processedImagesCount }} / {{ totalImagesCount }}
                </span>
            </div>
            <!-- Grid of items -->
            <div class="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                    <div 
                    v-for="item in localImages" 
                    :key="item.sku"
                    class="flex items-center gap-2 rounded border p-2 text-xs"
                    :class="imageMatches.has(item.sku) 
                        ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300' 
                        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'"
                    >
                    <div class="size-2 shrink-0 rounded-full" :class="imageMatches.has(item.sku) ? 'bg-green-500' : 'bg-amber-500'"></div>
                    <div class="min-w-0 flex-1 truncate">
                        <div class="font-medium">{{ item.sku }}</div>
                        <div class="opacity-75">{{ item.image_url }}</div>
                    </div>
                    <div v-if="imageMatches.has(item.sku)">
                        <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
    parsedItems: {
        type: Array,
        required: true
    },
    imageMatches: {
        type: Map, // <sku, File>
        required: true
    },
    processedImagesCount: {
        type: Number,
        default: 0
    },
    totalImagesCount: {
        type: Number,
        default: 0
    },
    fileCount: {
        type: Number,
        default: 0
    }
});

const emit = defineEmits(['files-selected']);
const { t } = useI18n();
const isDragOver = ref(false);
const imageUploadInput = ref(null);

const localImages = computed(() => {
    return props.parsedItems.filter(i => i.image_url && !i.image_url.match(/^https?:\/\//i));
});

const handleSelect = (e) => {
    emit('files-selected', e.target.files);
};

const handleDrop = (e) => {
    isDragOver.value = false;
    emit('files-selected', e.dataTransfer.files);
};
</script>
