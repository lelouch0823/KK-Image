<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-[var(--color-overlay-dim)] backdrop-blur-sm transition-opacity" aria-hidden="true" @click="$emit('update:modelValue', false)"></div>

      <!-- Modal Container -->
      <div class="flex min-h-screen items-center justify-center p-4">
        <!-- Modal Panel -->
        <div class="relative w-full max-w-4xl transform overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] text-left shadow-2xl transition-all">
          
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-muted)]/50 px-6 py-4">
              <h3 class="font-[Outfit] text-lg leading-6 font-bold text-[var(--text-main)]">
                  {{ editMode ? t('product.modal.edit_title') : t('product.modal.create_title') }}
              </h3>
              <button class="text-[var(--text-muted)] hover:text-[var(--text-secondary)] focus:outline-none" @click="$emit('update:modelValue', false)">
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
                              <label class="block text-sm font-medium text-[var(--text-secondary)]">{{ t('product.form.name') }} <span class="text-[var(--color-danger)]">*</span></label>
                              <input v-model="form.name" type="text" required class="input mt-1" :placeholder="t('product.form.name_placeholder')">
                          </div>
                          
                          <div>
                              <label class="block text-sm font-medium text-[var(--text-secondary)]">{{ t('product.form.description') }}</label>
                              <textarea v-model="form.description" rows="3" class="input mt-1 h-auto py-3" :placeholder="t('product.form.description_placeholder')"></textarea>
                          </div>
                      </div>

                      <!-- Brand & Series -->
                      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                              <label class="block text-sm font-medium text-[var(--text-secondary)]">{{ t('order.form.brand') }}</label>
                              <input v-model="form.brand" type="text" class="input mt-1" :placeholder="t('order.form.brandPlaceholder')">
                          </div>
                          <div>
                              <label class="block text-sm font-medium text-[var(--text-secondary)]">{{ t('order.form.series') }}</label>
                              <input v-model="form.series" type="text" class="input mt-1" :placeholder="t('order.form.seriesPlaceholder')">
                          </div>
                      </div>

                      <!-- Category -->
                      <div>
                          <label class="block text-sm font-medium text-[var(--text-secondary)]">{{ t('product.form.category') }}</label>
                          <input v-model="form.category" type="text" class="input mt-1" :placeholder="t('product.form.category_placeholder')">
                      </div>

                      <!-- Specifications: Size, Color, Material -->
                      <div class="space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]/50 p-4">
                          <h4 class="font-bold text-[var(--text-main)]">{{ t('product.form.specifications') }}</h4>
                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                              <div>
                                  <label class="block text-xs font-medium text-[var(--text-secondary)] uppercase">{{ t('order.form.size') }}</label>
                                  <input v-model="form.specifications.size" type="text" class="input mt-1 !h-9" :placeholder="t('order.form.sizePlaceholder')">
                              </div>
                              <div>
                                  <label class="block text-xs font-medium text-[var(--text-secondary)] uppercase">{{ t('order.form.color') }}</label>
                                  <input v-model="form.specifications.color" type="text" class="input mt-1 !h-9" :placeholder="t('order.form.colorPlaceholder')">
                              </div>
                              <div>
                                  <label class="block text-xs font-medium text-[var(--text-secondary)] uppercase">{{ t('order.form.material') }}</label>
                                  <input v-model="form.specifications.material" type="text" class="input mt-1 !h-9" :placeholder="t('order.form.materialPlaceholder')">
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
                              context="product"
                          />
                      </div>
                  </div>

                  <!-- Sidebar (1 span) -->
                  <div class="space-y-6">
                       <!-- Pricing Card -->
                       <div class="space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]/50 p-4">
                          <h4 class="font-bold text-[var(--text-main)]">{{ t('product.form.pricing_inventory') }}</h4>
                          <div>
                              <label class="block text-xs font-medium text-[var(--text-secondary)] uppercase">{{ t('product.form.price') }} <span class="text-[var(--color-danger)]">*</span></label>
                              <div class="relative mt-1 rounded-md shadow-sm">
                                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                      <span class="text-[var(--text-secondary)] sm:text-sm">¥</span>
                                  </div>
                                  <input v-model.number="form.price" type="number" required class="input block w-full pl-7" placeholder="0.00">
                              </div>
                          </div>
                          <div>
                              <label class="block text-xs font-medium text-[var(--text-secondary)] uppercase">{{ t('product.form.cost') }}</label>
                              <div class="relative mt-1 rounded-md shadow-sm">
                                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                      <span class="text-[var(--text-secondary)] sm:text-sm">¥</span>
                                  </div>
                                  <input v-model.number="form.costPrice" type="number" class="input block w-full pl-7" placeholder="0.00">
                              </div>
                          </div>
                       </div>

                       <!-- Inventory Card -->
                      <div class="space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]/50 p-4">
                         <h4 class="font-bold text-[var(--text-main)]">{{ t('product.form.inventory') }}</h4>
                         <div>
                             <label class="block text-xs font-medium text-[var(--text-secondary)] uppercase">{{ t('product.form.sku') }} <span class="text-[var(--color-danger)]">*</span></label>
                             <input v-model="form.sku" type="text" required class="input mt-1 font-mono uppercase">
                         </div>
                          <div class="grid grid-cols-2 gap-4">
                             <div>
                                 <label class="block text-xs font-medium text-[var(--text-secondary)] uppercase">{{ t('product.form.stock') }}</label>
                                  <input v-model.number="form.stockQuantity" type="number" class="input mt-1">
                             </div>
                             <div>
                                 <label class="block text-xs font-medium text-[var(--text-secondary)] uppercase">{{ t('product.form.alert_at') }}</label>
                                  <input v-model.number="form.alertThreshold" type="number" class="input mt-1">
                             </div>
                          </div>
                      </div>

                       <!-- Organization Card -->
                      <div class="space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]/50 p-4">
                         <h4 class="font-bold text-[var(--text-main)]">{{ t('product.form.organization') }}</h4>
                         <div>
                             <label class="block text-xs font-medium text-[var(--text-secondary)] uppercase">{{ t('product.form.slug_seo') }}</label>
                             <input v-model="form.slug" type="text" class="input mt-1" :placeholder="t('product.form.slug_placeholder')">
                         </div>
                         <div>
                             <label class="block text-xs font-medium text-[var(--text-secondary)] uppercase">{{ t('product.table.header.status') }}</label>
                             <select v-model="form.status" class="input mt-1 appearance-none py-1 pr-10 pl-3">
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
          <div class="flex justify-end gap-3 border-t border-[var(--border-color)] bg-[var(--bg-muted)] px-6 py-4">
              <button type="button" class="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none" @click="$emit('update:modelValue', false)">
                  {{ t('product.action.cancel') }}
              </button>
              <button type="button" :disabled="submitting" class="flex items-center gap-2 rounded-lg border border-transparent bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] shadow-sm hover:opacity-90 focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none disabled:opacity-50" @click="handleSubmit">
                  <span v-if="submitting" class="size-4 animate-spin rounded-full border-2 border-[var(--text-inverse)] border-t-transparent"></span>
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
