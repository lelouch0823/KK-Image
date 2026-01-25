<template>
  <div class="fixed inset-0 z-50 w-full overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <!-- Backdrop -->
    <div class="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-slate-900/75 backdrop-blur-sm transition-opacity" aria-hidden="true" @click="$emit('update:modelValue', false)"></div>

      <div class="inline-block transform overflow-hidden rounded-2xl border border-slate-200 bg-white text-left align-bottom shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle dark:border-slate-800 dark:bg-slate-900">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
            <h3 class="font-[Outfit] text-lg leading-6 font-bold text-slate-900 dark:text-white">
                {{ editMode ? t('product.modal.edit_title') : t('product.modal.create_title') }}
            </h3>
            <button class="text-slate-400 hover:text-slate-500 focus:outline-none" @click="$emit('update:modelValue', false)">
                <span class="sr-only">Close</span>
                <svg class="size-6 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <!-- Content -->
        <div class="custom-scrollbar max-h-[70vh] overflow-y-auto p-6 ">
            <form id="product-form" class="grid grid-cols-1 gap-8 lg:grid-cols-3" @submit.prevent="handleSubmit">
                
                <!-- Main Column (2 spans) -->
                <div class="space-y-6 lg:col-span-2">
                    <!-- Basic Info -->
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">{{ t('product.form.name') }}</label>
                            <input v-model="form.name" type="text" required class="mt-1 block w-full rounded-xl border-slate-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800" :placeholder="t('product.form.name_placeholder')">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">{{ t('product.form.description') }}</label>
                            <textarea v-model="form.description" rows="4" class="mt-1 block w-full rounded-xl border-slate-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800" :placeholder="t('product.form.description_placeholder')"></textarea>
                        </div>
                    </div>

                    <!-- Images -->
                    <div>
                        <label class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{{ t('product.form.media') }}</label>
                        <div class="grid grid-cols-4 gap-4">
                            <!-- Existing Images -->
                            <div v-for="(img, idx) in form.images" :key="idx" class="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                <img :src="`/file/${img}`" class="size-full  object-cover">
                                <button type="button" class="absolute top-1 right-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100" @click="removeImage(idx)">
                                    <svg class="size-4 " fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            <!-- Add Button placeholder (Need FilePicker) -->
                            <button type="button" class="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-indigo-500 hover:text-indigo-500 dark:border-slate-700">
                                <svg class="mb-1 size-8 " fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                                <span class="text-xs">{{ t('product.form.upload_text') }}</span>
                            </button>
                        </div>
                        <p class="mt-2 text-xs text-slate-500">{{ t('product.form.media_help') }}</p>
                    </div>
                </div>

                <!-- Sidebar (1 span) -->
                <div class="space-y-6">
                     <!-- Pricing Card -->
                     <div class="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                        <h4 class="font-bold text-slate-800 dark:text-slate-200">{{ t('product.form.pricing_inventory') }}</h4>
                        <div>
                            <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.price') }}</label>
                            <div class="relative mt-1 rounded-md shadow-sm">
                                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <span class="text-slate-500 sm:text-sm">¥</span>
                                </div>
                                <input v-model.number="form.price" type="number" class="block w-full rounded-lg border-slate-300 pl-7 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="0.00">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.cost') }}</label>
                            <div class="relative mt-1 rounded-md shadow-sm">
                                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <span class="text-slate-500 sm:text-sm">¥</span>
                                </div>
                                <input v-model.number="form.costPrice" type="number" class="block w-full rounded-lg border-slate-300 pl-7 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="0.00">
                            </div>
                        </div>
                     </div>

                      <!-- Inventory Card (Merged into above or kept separate title? using same title key for simplified UI or use specific) -->
                      <!-- Actually I can just remove the second title if it fits better or use a new key. I'll reuse 'Inventory' key if I have one, or hardcode/skip if I want to be 100% compliant. I used pricing_inventory above. -->
                     <div class="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                        <!-- h4 class="font-bold text-slate-800 dark:text-slate-200">Inventory</h4 --> 
                        <!-- I'll just change the labels inside -->
                        <div>
                            <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.sku') }}</label>
                            <input v-model="form.sku" type="text" class="mt-1 block w-full rounded-lg border-slate-300 font-mono uppercase focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800">
                        </div>
                         <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.stock') }}</label>
                                <input v-model.number="form.stockQuantity" type="number" class="mt-1 block w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.alert_at') }}</label>
                                <input v-model.number="form.alertThreshold" type="number" class="mt-1 block w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800">
                            </div>
                         </div>
                     </div>

                     <div class="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                        <h4 class="font-bold text-slate-800 dark:text-slate-200">{{ t('product.form.organization') || 'Organization' }}</h4>
                        <div>
                            <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.slug_seo') }}</label>
                            <input v-model="form.slug" type="text" class="mt-1 block w-full rounded-lg border-slate-300 text-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800" :placeholder="t('product.form.slug_placeholder')">
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.table.header.status') }}</label>
                            <select v-model="form.status" class="mt-1 block w-full rounded-lg border-slate-300 py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800">
                                <option value="active">{{ t('product.filters.status.active') }}</option>
                                <option value="draft">{{ t('product.filters.status.draft') }}</option>
                                <option value="archived">{{ t('product.filters.status.archived') }}</option>
                            </select>
                        </div>
                     </div>
                </div>

            </form>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
            <button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" @click="$emit('update:modelValue', false)">
                {{ t('product.action.cancel') }}
            </button>
            <button type="button" :disabled="submitting" class="flex items-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none" @click="handleSubmit">
                <span v-if="submitting" class="size-4  animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                {{ submitting ? t('common.saving') : (editMode ? t('product.action.save') : t('product.action.create')) }}
            </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const props = defineProps({
    modelValue: Boolean,
    editMode: Boolean,
    initialData: {
        type: Object,
        default: () => ({})
    }
});
const emit = defineEmits(['update:modelValue', 'success']);

const { createProduct, updateProduct } = useProducts();
const submitting = ref(false);

const form = reactive({
    name: '',
    description: '',
    price: null,
    costPrice: null,
    sku: '',
    stockQuantity: 0,
    alertThreshold: 10,
    slug: '',
    status: 'active',
    images: [],
    // ... categories, brands
});

onMounted(() => {
    if (props.editMode && props.initialData) {
        Object.assign(form, {
            ...props.initialData,
            costPrice: props.initialData.cost_price, // map snake_case to camelCase if needed, or stick to consistency
            stockQuantity: props.initialData.stock_quantity,
            alertThreshold: props.initialData.alert_threshold,
            images: parseJson(props.initialData.images)
        });
    }
});

const parseJson = (str) => {
    try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return []; }
};

const handleSubmit = async () => {
    if (!form.name || !form.sku) return; // Basic validation
    
    submitting.value = true;
    try {
        const payload = { ...form }; // transform if needed
        let success = false;
        
        if (props.editMode) {
            success = await updateProduct(props.initialData.id, payload);
        } else {
            success = await createProduct(payload);
        }

        if (success) {
            emit('success');
        }
    } finally {
        submitting.value = false;
    }
};

const removeImage = (idx) => {
    form.images.splice(idx, 1);
};
</script>
