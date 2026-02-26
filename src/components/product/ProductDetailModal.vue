<template>
  <Modal 
    v-model="isVisible"
    size="6xl"
  >
    <template #header>
      <div class="flex flex-1 items-center justify-between gap-4">
        <h3 class="text-(--text-main) text-lg font-bold">
          {{ t('product.manager.detail_title') || t('router.product_detail') }}
        </h3>
        <div class="flex items-center gap-2">
          <!-- 预留动作插槽 -->
          <slot name="header-actions" :product="currentProduct"></slot>
        </div>
      </div>
    </template>
    
    <div class="relative min-h-[300px]">
      <div v-if="loading" class="bg-(--bg-page)/50 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
         <AppIcon name="spinner" class="text-primary size-8 animate-spin" />
      </div>
      
      <ProductDetail 
        v-else-if="currentProduct" 
        :product="currentProduct" 
      />
      
      <div v-else-if="error" class="text-danger flex h-full flex-col items-center justify-center space-y-3 py-10 text-center">
        <AppIcon name="exclamation-triangle" class="size-10 opacity-80" />
        <p class="text-sm font-medium">{{ error }}</p>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import ProductDetail from '@/components/product/ProductDetail.vue';
import { useProducts } from '@/composables/useProducts';
import AppIcon from '@/components/ui/AppIcon.vue';

// SOTA: Use defineModel for v-model binding
const isVisible = defineModel('show', { type: Boolean, default: false });

const props = defineProps({
  productId: {
    type: [String, Number],
    default: null
  },
  // SOTA: Allow passing initial data directly to avoid network requests
  initialData: {
    type: Object,
    default: null
  }
});

const { t } = useI18n();
const { loadProduct } = useProducts();

const loading = ref(false);
const error = ref('');
const currentProduct = ref(null);

const fetchProduct = async () => {
  if (!props.productId) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    const data = await loadProduct(props.productId);
    if (data) {
      currentProduct.value = data;
    } else {
      error.value = t('common.error.network_error');
    }
  } catch (err) {
    error.value = err.message || t('common.error.network_error');
  } finally {
    loading.value = false;
  }
};

watch(
  [() => props.productId, () => props.initialData, isVisible],
  async () => {
    // 只有在打开弹窗时才去响应
    if (!isVisible.value) {
      // 延迟清除数据，保证退出动画平滑
      setTimeout(() => {
        if (!props.initialData) currentProduct.value = null;
      }, 300);
      return;
    }

    // 如果传递了完整的数据对象，优先直接使用
    if (props.initialData) {
      currentProduct.value = props.initialData;
      if (props.productId && !Array.isArray(props.initialData.variants)) {
        await fetchProduct();
      }
    } 
    // 否则去后台请求
    else if (props.productId && (!currentProduct.value || !Array.isArray(currentProduct.value.variants))) {
      await fetchProduct();
    }
  },
  { immediate: true }
);
</script>
