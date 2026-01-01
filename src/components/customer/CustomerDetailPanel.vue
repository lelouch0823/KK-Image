<template>
  <div class="fixed inset-0 z-50 overflow-hidden" v-if="modelValue" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
    <div class="absolute inset-0 overflow-hidden">
      <!-- 背景遮罩 -->
      <div 
        class="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
        @click="close"
        aria-hidden="true"
      ></div>

      <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div class="pointer-events-auto w-screen max-w-md transform transition ease-in-out duration-500 sm:duration-700 bg-white shadow-xl flex flex-col h-full">
          <!-- 头部 -->
          <div class="px-4 py-6 sm:px-6 border-b border-gray-200">
            <div class="flex items-start justify-between">
              <h2 class="text-lg font-medium text-gray-900" id="slide-over-title">
                {{ customer?.name }}
              </h2>
              <div class="ml-3 flex h-7 items-center">
                <button 
                  type="button" 
                  class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  @click="close"
                >
                  <span class="sr-only">{{ t('common.close') }}</span>
                  <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div class="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:space-x-6">
              <div class="mt-2 text-sm text-gray-500">
                <span class="font-medium mr-1">{{ t('customer.form.company') }}:</span> 
                {{ customer?.company || '-' }}
              </div>
              <div class="mt-2 text-sm text-gray-500">
                <span class="font-medium mr-1">{{ t('customer.form.phone') }}:</span>
                {{ customer?.phone || '-' }}
              </div>
            </div>
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-y-auto relative">
            <!-- Tabs -->
            <div class="border-b border-gray-200">
              <nav class="-mb-px flex px-6" aria-label="Tabs">
                <button
                  v-for="tab in tabs"
                  :key="tab.key"
                  @click="currentTab = tab.key"
                  :class="[
                    currentTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                    'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm mr-8'
                  ]"
                >
                  {{ tab.name }}
                </button>
              </nav>
            </div>

            <!-- Tab Panels -->
            <div class="p-6">
              <!-- 基本信息 -->
              <div v-if="currentTab === 'info'" class="space-y-6">
                <!-- 操作栏 -->
                <div class="flex justify-start gap-4 mb-6">
                  <button 
                    @click="$emit('edit', customer)"
                    class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <svg class="-ml-0.5 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    {{ t('common.edit') }}
                  </button>
                  <button 
                    @click="handleDelete"
                    class="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <svg class="-ml-0.5 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    {{ t('common.delete') }}
                  </button>
                </div>

                <div class="border-t border-gray-100 pt-4">
                  <h4 class="text-sm font-medium text-gray-500 mb-3">{{ t('customer.form.basicInfo') }}</h4>
                  <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div class="sm:col-span-1">
                      <dt class="text-xs font-medium text-gray-400">{{ t('customer.form.email') }}</dt>
                      <dd class="mt-1 text-sm text-gray-900">{{ customer?.email || '-' }}</dd>
                    </div>
                    <div class="sm:col-span-1">
                      <dt class="text-xs font-medium text-gray-400">{{ t('common.createdAt') }}</dt>
                      <dd class="mt-1 text-sm text-gray-900">{{ formatDate(customer?.createdAt) }}</dd>
                    </div>
                    
                    <div class="sm:col-span-2">
                      <dt class="text-xs font-medium text-gray-400">{{ t('customer.form.tags') }}</dt>
                      <dd class="mt-1 text-sm text-gray-900 flex flex-wrap gap-2">
                        <span v-for="tag in customer?.tags" :key="tag" class="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                          {{ tag }}
                        </span>
                        <span v-if="!customer?.tags?.length" class="text-gray-400">-</span>
                      </dd>
                    </div>

                    <div class="sm:col-span-2">
                      <dt class="text-xs font-medium text-gray-400">{{ t('customer.form.address') }}</dt>
                      <dd class="mt-1 text-sm text-gray-900">{{ customer?.address || '-' }}</dd>
                    </div>
                    
                    <div class="sm:col-span-2">
                      <dt class="text-xs font-medium text-gray-400">{{ t('customer.form.remark') }}</dt>
                      <dd class="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{{ customer?.remark || '-' }}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <!-- 历史订单 -->
              <div v-if="currentTab === 'orders'" class="space-y-4">
                <div v-if="loadingOrders" class="text-center py-8">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
                
                <div v-else-if="orders.length === 0" class="text-center py-8 text-gray-500">
                  <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p class="mt-2 text-sm">{{ t('customer.detail.noOrders') }}</p>
                </div>

                <div v-else class="space-y-4">
                   <div 
                      v-for="order in orders" 
                      :key="order.id" 
                      class="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                    >
                      <div class="flex justify-between items-start mb-2">
                        <div>
                          <p class="text-sm font-medium text-gray-900">{{ order.productName }}</p>
                          <p class="text-xs text-gray-500">{{ order.orderNo }} • {{ formatDate(order.createdAt) }}</p>
                        </div>
                        <StatusBadge :status="order.status" class="scale-90 origin-right" />
                      </div>
                      <div class="flex gap-2 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
                        <img 
                          v-if="order.mainImage" 
                          :src="order.mainImage" 
                          class="w-12 h-12 rounded object-cover"
                        >
                        <div class="flex-1 flex flex-col justify-center">
                          <p>{{ t('common.salesperson') }}: {{ order.salespersonName || '-' }}</p>
                          <p class="font-medium text-gray-900 mt-1">{{ formatCurrency(order.totalAmount, order.currency) }}</p>
                        </div>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 删除确认弹窗 -->
  <ConfirmDialog
    v-model="confirmData.show"
    :title="confirmData.title"
    :message="confirmData.message"
    :type="confirmData.type"
    :loading="confirmData.loading"
    @confirm="confirmData.onConfirm"
  />
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { API } from '@/utils/constants';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const props = defineProps({
  modelValue: Boolean,
  customer: Object
});

const emit = defineEmits(['update:modelValue', 'refresh', 'edit']);

const { t } = useI18n();
const { addToast } = useToast();

const currentTab = ref('info');
const orders = ref([]);
const loadingOrders = ref(false);
const deleting = ref(false);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {}
});

const tabs = computed(() => [
  { key: 'info', name: t('customer.form.basicInfo') },
  { key: 'orders', name: t('customer.detail.historyOrders') }
]);

const close = () => {
  emit('update:modelValue', false);
};

const loadOrders = async () => {
  if (!props.customer?.id) return;
  
  loadingOrders.value = true;
  try {
    const res = await fetch(API.MANAGE_CUSTOMER_ORDERS(props.customer.id));
    const result = await res.json();
    if (result.success) {
      orders.value = result.data;
    }
  } catch (e) {
    addToast({ message: t('common.loadFailed'), type: 'error' });
  } finally {
    loadingOrders.value = false;
  }
};

const handleDelete = () => {
  confirmData.value = {
    show: true,
    title: t('common.delete'),
    message: t('customer.manage.deleteConfirm'),
    type: 'danger',
    onConfirm: confirmDelete
  };
};

const confirmDelete = async () => {
  if (!props.customer?.id) return;
  
  confirmData.value.loading = true;
  try {
    const res = await fetch(`${API.MANAGE_CUSTOMER}/${props.customer.id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    
    if (result.success) {
      addToast({ message: t('common.deleteSuccess'), type: 'success' });
      confirmData.value.show = false;
      close();
      emit('refresh');
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    confirmData.value.loading = false;
  }
};

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    currentTab.value = 'info';
    orders.value = []; // Reset
    // Pre-fetch orders if needed or wait for tab switch? 
    // Let's lazy load on tab switch or aggressive load now. 
    // Better lazy load, but for smoothness let's load if switching to tab?
    // Let's just reset and load when tab changes.
  }
});

watch(currentTab, (newTab) => {
  if (newTab === 'orders' && orders.value.length === 0) {
    loadOrders();
  }
});

// Also watch customer change to reload if panel stays open
watch(() => props.customer?.id, (newId) => {
  if (newId && currentTab.value === 'orders') {
    loadOrders();
  }
});
</script>
