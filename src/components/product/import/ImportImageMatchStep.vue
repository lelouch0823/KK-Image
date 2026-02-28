<template>
    <div class="space-y-4">
        <div class="rounded-xl border border-(--border-color) bg-(--bg-card) p-4">
            <h3 class="mb-1 text-lg font-semibold text-(--text-main)">{{ t('product.import.step_image', '图片智能匹配') }}</h3>
            <p class="text-sm text-(--text-secondary)">
                {{ t('product.import.image_match_desc', { count: totalImagesCount }, '检测到 Excel 中包含 {count} 个本地图片引用。请上传对应图片。') }}
            </p>
        </div>

        <!-- Dropzone -->
        <div 
            class="relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition-colors"
            :class="isDragOver ? 'border-primary bg-primary/10' : 'border-(--border-color) bg-(--bg-muted) hover:bg-(--bg-hover)'"
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
                 <div class="bg-primary/10 mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
                    <AppIcon name="photo" class="text-primary size-6" />
                 </div>
                <p class="mt-2 text-sm font-medium text-(--text-main)">
                    <span class="text-primary">{{ t('product.import.click_to_upload_images', '点击上传图片') }}</span>
                    {{ t('product.import.image_upload_batch', '（支持批量/拖拽）') }}
                </p>
                <p class="mt-1 text-xs text-(--text-secondary)">{{ t('product.import.image_selected_count', { count: fileCount }, '已选择 {count} 个文件') }}</p>
            </div>
        </div>

        <!-- Match Stats -->
        <div class="rounded-xl border border-(--border-color) bg-(--bg-card) p-4 shadow-sm">
            <div class="mb-3 flex items-center justify-between">
                <span class="text-sm font-semibold text-(--text-main)">{{ t('product.import.auto_matched', '匹配结果') }}</span>
                <span class="bg-primary-bg text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                    {{ processedImagesCount }} / {{ totalImagesCount }}
                </span>
            </div>
            <!-- Grid of items -->
            <div class="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                    <div 
                    v-for="item in localImages" 
                    :key="getItemMatchKey(item)"
                    class="flex items-center gap-2 rounded-lg border p-2 text-xs"
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
                         <AppIcon name="check-circle" class="size-4" />
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
