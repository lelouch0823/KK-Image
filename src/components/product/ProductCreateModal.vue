<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-slate-900/75 backdrop-blur-sm transition-opacity" aria-hidden="true" @click="$emit('update:modelValue', false)"></div>

      <!-- Modal Container -->
      <div class="flex min-h-screen items-center justify-center p-4">
        <!-- Modal Panel -->
        <div class="relative w-full max-w-4xl transform overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
          
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              <h3 class="font-[Outfit] text-lg leading-6 font-bold text-slate-900 dark:text-white">
                  {{ editMode ? t('product.modal.edit_title') : t('product.modal.create_title') }}
              </h3>
              <button class="text-slate-400 hover:text-slate-500 focus:outline-none" @click="$emit('update:modelValue', false)">
                  <span class="sr-only">{{ t('common.close') }}</span>
                  <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
          </div>

          <!-- Content -->
          <div class="custom-scrollbar max-h-[70vh] overflow-y-auto p-6">
              <form id="product-form" class="grid grid-cols-1 gap-8 lg:grid-cols-3" @submit.prevent="handleSubmit">
                  
                  <!-- Main Column (2 spans) -->
                  <div class="space-y-6 lg:col-span-2">
                      <!-- Basic Info -->
                      <div class="space-y-4">
                          <div>
                              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">{{ t('product.form.name') }} <span class="text-red-500">*</span></label>
                              <input v-model="form.name" type="text" required class="mt-1 block w-full rounded-xl border-slate-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" :placeholder="t('product.form.name_placeholder')">
                          </div>
                          
                          <div>
                              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">{{ t('product.form.description') }}</label>
                              <textarea v-model="form.description" rows="3" class="mt-1 block w-full rounded-xl border-slate-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" :placeholder="t('product.form.description_placeholder')"></textarea>
                          </div>
                      </div>

                      <!-- Brand & Series -->
                      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">{{ t('order.form.brand') }}</label>
                              <input v-model="form.brand" type="text" class="mt-1 block w-full rounded-xl border-slate-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" :placeholder="t('order.form.brandPlaceholder')">
                          </div>
                          <div>
                              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">{{ t('order.form.series') }}</label>
                              <input v-model="form.series" type="text" class="mt-1 block w-full rounded-xl border-slate-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" :placeholder="t('order.form.seriesPlaceholder')">
                          </div>
                      </div>

                      <!-- Category -->
                      <div>
                          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">{{ t('product.form.category') }}</label>
                          <input v-model="form.category" type="text" class="mt-1 block w-full rounded-xl border-slate-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" :placeholder="t('product.form.category_placeholder')">
                      </div>

                      <!-- Specifications: Size, Color, Material -->
                      <div class="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                          <h4 class="font-bold text-slate-800 dark:text-slate-200">{{ t('product.form.specifications') }}</h4>
                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                              <div>
                                  <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('order.form.size') }}</label>
                                  <input v-model="form.specifications.size" type="text" class="mt-1 block w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" :placeholder="t('order.form.sizePlaceholder')">
                              </div>
                              <div>
                                  <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('order.form.color') }}</label>
                                  <input v-model="form.specifications.color" type="text" class="mt-1 block w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" :placeholder="t('order.form.colorPlaceholder')">
                              </div>
                              <div>
                                  <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('order.form.material') }}</label>
                                  <input v-model="form.specifications.material" type="text" class="mt-1 block w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" :placeholder="t('order.form.materialPlaceholder')">
                              </div>
                          </div>
                      </div>

                      <!-- Images -->
                      <div>
                          <ImageUploader 
                              v-model="imageObjects"
                              :label="t('product.form.media')"
                              :hint="t('product.form.media_help')"
                              :upload-endpoint="API.MANAGE_UPLOAD"
                              :max-files="10"
                          />
                      </div>
                  </div>

                  <!-- Sidebar (1 span) -->
                  <div class="space-y-6">
                       <!-- Pricing Card -->
                       <div class="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                          <h4 class="font-bold text-slate-800 dark:text-slate-200">{{ t('product.form.pricing_inventory') }}</h4>
                          <div>
                              <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.price') }} <span class="text-red-500">*</span></label>
                              <div class="relative mt-1 rounded-md shadow-sm">
                                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                      <span class="text-slate-500 sm:text-sm">¥</span>
                                  </div>
                                  <input v-model.number="form.price" type="number" required class="block w-full rounded-lg border-slate-300 pl-7 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="0.00">
                              </div>
                          </div>
                          <div>
                              <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.cost') }}</label>
                              <div class="relative mt-1 rounded-md shadow-sm">
                                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                      <span class="text-slate-500 sm:text-sm">¥</span>
                                  </div>
                                  <input v-model.number="form.costPrice" type="number" class="block w-full rounded-lg border-slate-300 pl-7 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="0.00">
                              </div>
                          </div>
                       </div>

                       <!-- Inventory Card -->
                      <div class="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                         <h4 class="font-bold text-slate-800 dark:text-slate-200">{{ t('product.form.inventory') }}</h4>
                         <div>
                             <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.sku') }} <span class="text-red-500">*</span></label>
                             <input v-model="form.sku" type="text" required class="mt-1 block w-full rounded-lg border-slate-300 font-mono uppercase focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                         </div>
                          <div class="grid grid-cols-2 gap-4">
                             <div>
                                 <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.stock') }}</label>
                                 <input v-model.number="form.stockQuantity" type="number" class="mt-1 block w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                             </div>
                             <div>
                                 <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.alert_at') }}</label>
                                 <input v-model.number="form.alertThreshold" type="number" class="mt-1 block w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                             </div>
                          </div>
                      </div>

                      <!-- Organization Card -->
                      <div class="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                         <h4 class="font-bold text-slate-800 dark:text-slate-200">{{ t('product.form.organization') }}</h4>
                         <div>
                             <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.form.slug_seo') }}</label>
                             <input v-model="form.slug" type="text" class="mt-1 block w-full rounded-lg border-slate-300 text-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400" :placeholder="t('product.form.slug_placeholder')">
                         </div>
                         <div>
                             <label class="block text-xs font-medium text-slate-500 uppercase">{{ t('product.table.header.status') }}</label>
                             <select v-model="form.status" class="mt-1 block w-full rounded-lg border-slate-300 py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
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
              <button type="button" :disabled="submitting" class="flex items-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50" @click="handleSubmit">
                  <span v-if="submitting" class="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  {{ submitting ? t('common.saving') : (editMode ? t('product.action.save') : t('product.action.create')) }}
              </button>
          </div>

        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import ImageUploader from '@/components/common/ImageUploader.vue';
import { API } from '@/utils/constants';

const { t } = useI18n();
const { addToast } = useToast();
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

const imageObjects = ref([]);

const form = reactive({
    name: '',
    description: '',
    brand: '',
    series: '',
    category: '',
    price: null,
    costPrice: null,
    sku: '',
    stockQuantity: 0,
    alertThreshold: 10,
    slug: '',
    status: 'active',
    images: [],
    specifications: {
        size: '',
        color: '',
        material: '',
    },
});

// Sync imageObjects back to form.images before submit (although we can just use imageObjects in submit)
// Actually better to just sync on submit.

// Reset form when modal opens
watch(() => props.modelValue, (isOpen) => {
    if (isOpen) {
        if (props.editMode && props.initialData) {
            fillFormFromData(props.initialData);
        } else {
            resetForm();
        }
    }
}, { immediate: true });

const fillFormFromData = (data) => {
    const imgs = parseJson(data.images) || [];
    
    Object.assign(form, {
        name: data.name || '',
        description: data.description || '',
        brand: data.brand || '',
        series: data.series || '',
        category: data.category || '',
        price: data.price ?? null,
        costPrice: data.cost_price ?? null,
        sku: data.sku || '',
        stockQuantity: data.stock_quantity ?? 0,
        alertThreshold: data.alert_threshold ?? 10,
        slug: data.slug || '',
        status: data.status || 'active',
        images: imgs,
        specifications: parseJson(data.specifications) || { size: '', color: '', material: '' },
    });

    // Populate imageObjects for Uploader
    imageObjects.value = imgs.map(id => ({
        id: id,
        url: `/file/${id}`
    }));
};

const resetForm = () => {
    Object.assign(form, {
        name: '',
        description: '',
        brand: '',
        series: '',
        category: '',
        price: null,
        costPrice: null,
        sku: '',
        stockQuantity: 0,
        alertThreshold: 10,
        slug: '',
        status: 'active',
        images: [],
        specifications: { size: '', color: '', material: '' },
    });
    imageObjects.value = [];
};

const parseJson = (str) => {
    try { return typeof str === 'string' ? JSON.parse(str) : (str || null); } catch { return null; }
};

const handleSubmit = async () => {
    if (!form.name || !form.sku) {
        addToast({ 
            message: t('common.validation_error', '请填写必填项 (商品名称, SKU)'), 
            type: 'error' 
        });
        return;
    }
    
    submitting.value = true;
    try {
        // Extract IDs from imageObjects
        const currentImageIds = imageObjects.value.map(f => f.id).filter(Boolean);

        // Transform to snake_case for API
        const payload = {
            name: form.name,
            description: form.description,
            brand: form.brand,
            series: form.series,
            category: form.category,
            price: form.price,
            cost_price: form.costPrice,
            sku: form.sku,
            stock_quantity: form.stockQuantity,
            alert_threshold: form.alertThreshold,
            slug: form.slug || undefined,
            status: form.status,
            images: currentImageIds, // Send array of IDs
            specifications: form.specifications,
        };
        
        let success = false;
        
        if (props.editMode) {
            success = await updateProduct(props.initialData.id, payload);
        } else {
            success = await createProduct(payload);
        }

        if (success) {
            emit('success');
            emit('update:modelValue', false);
        }
    } finally {
        submitting.value = false;
    }
};
</script>
