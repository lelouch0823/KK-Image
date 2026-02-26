<template>
    <div>
        <h3 class="text-(--text-main) mb-2 text-lg font-medium">{{ t('product.import.step_image', '图片智能匹配') }}</h3>
        <p class="text-(--text-secondary) mb-4 text-sm">
            检测到Excel中包含 {{ totalImagesCount }} 个本地图片引用。请上传对应的图片文件。
        </p>

        <!-- Dropzone -->
        <div 
            class="border-(--border-color) bg-(--bg-muted) hover:bg-(--bg-hover) relative mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors"
            :class="{ 'border-primary bg-primary/10': isDragOver }"
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
                 <AppIcon name="photo" class="text-(--text-muted) mx-auto size-10" />
                <p class="text-(--text-secondary) mt-2 text-sm">
                    <span class="text-primary font-medium hover:opacity-80">点击选择图片</span>
                    (支持批量/拖拽)
                </p>
                <p class="text-(--text-muted) mt-1 text-xs">已选择 {{ fileCount }} 个文件</p>
            </div>
        </div>

        <!-- Match Stats -->
        <div class="border-(--border-color) bg-(--bg-card) rounded-lg border p-4 shadow-sm">
            <div class="mb-3 flex items-center justify-between">
                <span class="text-(--text-main) text-sm font-medium">匹配结果</span>
                <span class="bg-primary-bg text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                    {{ processedImagesCount }} / {{ totalImagesCount }}
                </span>
            </div>
            <!-- Grid of items -->
            <div class="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                    <div 
                    v-for="item in localImages" 
                    :key="getItemMatchKey(item)"
                    class="flex items-center gap-2 rounded border p-2 text-xs"
                    :class="imageMatches.has(getItemMatchKey(item))
                        ? 'border-success/20 bg-success/5 text-success' 
                        : 'border-warning/20 bg-warning/5 text-warning'"
                    >
                    <div class="size-2 shrink-0 rounded-full" :class="imageMatches.has(getItemMatchKey(item)) ? 'bg-success' : 'bg-warning'"></div>
                    <div class="min-w-0 flex-1 truncate">
                        <div class="font-medium">{{ getItemMatchKey(item) }}</div>
                        <div class="opacity-75">{{ item.image_url }}</div>
                    </div>
                    <div v-if="imageMatches.has(getItemMatchKey(item))">
                         <AppIcon name="check" class="size-4" />
                    </div>
                    </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';
import { getItemMatchKey } from './match-keys.js';

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
