<template>
  <div class="flex h-full flex-col bg-[var(--bg-card)]">
    <!-- 头部 -->
    <div class="border-b border-[var(--border-color)] px-4 py-6 sm:px-6">
      <div class="flex items-start justify-between">
        <h2 id="slide-over-title" class="text-lg font-medium text-[var(--text-primary)]">
          {{ customer?.name }}
        </h2>
        <div class="ml-3 flex h-7 items-center">
          <button
            type="button"
            class="focus:ring-primary focus:ring-2 focus:ring-offset-2 focus:outline-none rounded-md bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            @click="$emit('close')"
          >
            <span class="sr-only">{{ t('common.close') }}</span>
            <svg
              class="size-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div class="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:space-x-6">
        <div class="mt-2 text-sm text-[var(--text-secondary)]">
          <span class="mr-1 font-medium">{{ t('customer.form.company') }}:</span>
          {{ customer?.company || '-' }}
        </div>
        <div class="mt-2 text-sm text-[var(--text-secondary)]">
          <span class="mr-1 font-medium">{{ t('customer.form.phone') }}:</span>
          {{ customer?.phone || '-' }}
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="relative flex-1 overflow-y-auto">
      <!-- Tabs -->
      <div class="border-b border-[var(--border-color)]">
        <nav class="-mb-px flex px-6" aria-label="Tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="[
              currentTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]',
              'mr-8 border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap',
            ]"
            @click="currentTab = tab.key"
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
          <div class="mb-6 flex justify-start gap-4">
            <button
              class="focus:ring-primary focus:ring-2 focus:ring-offset-2 focus:outline-none inline-flex items-center rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-sm leading-4 font-medium text-[var(--text-primary)] shadow-sm hover:bg-[var(--bg-hover)]"
              @click="$emit('edit', customer)"
            >
              <svg
                class="mr-2 -ml-0.5 size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              {{ t('common.edit') }}
            </button>
            <button
              class="inline-flex items-center rounded-md border border-transparent bg-red-600 px-3 py-2 text-sm leading-4 font-medium text-white shadow-sm hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
              @click="handleDelete"
            >
              <svg
                class="mr-2 -ml-0.5 size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              {{ t('common.delete') }}
            </button>
          </div>

          <div class="border-t border-[var(--border-color)] pt-4">
            <h4 class="mb-3 text-sm font-medium text-[var(--text-secondary)]">
              {{ t('customer.form.basicInfo') }}
            </h4>
            <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="sm:col-span-1">
                <dt class="text-xs font-medium text-[var(--text-secondary)]">
                  {{ t('customer.form.phone') }}
                </dt>
                <dd class="mt-1 text-sm text-[var(--text-primary)]">{{ customer?.phone || '-' }}</dd>
              </div>
              <div class="sm:col-span-1">
                <dt class="text-xs font-medium text-[var(--text-secondary)]">{{ t('common.createdAt') }}</dt>
                <dd class="mt-1 text-sm text-[var(--text-primary)]">
                  {{ formatDate(customer?.createdAt) }}
                </dd>
              </div>

              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-[var(--text-secondary)]">
                  {{ t('customer.form.tags') }}
                </dt>
                <dd class="mt-1 flex flex-wrap gap-2 text-sm text-[var(--text-primary)]">
                  <span
                    v-for="tag in customer?.tags"
                    :key="tag"
                    class="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs"
                  >
                    {{ tag }}
                  </span>
                  <span v-if="!customer?.tags?.length" class="text-[var(--text-secondary)]">-</span>
                </dd>
              </div>

              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-[var(--text-secondary)]">
                  {{ t('customer.form.email') }}
                </dt>
                <dd class="mt-1 text-sm text-[var(--text-primary)]">{{ customer?.email || '-' }}</dd>
              </div>

              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-[var(--text-secondary)]">
                  {{ t('customer.form.address') }}
                </dt>
                <dd class="mt-1 text-sm text-[var(--text-primary)]">{{ customer?.address || '-' }}</dd>
              </div>

              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-[var(--text-secondary)]">
                  {{ t('customer.form.remark') }}
                </dt>
                <dd class="mt-1 text-sm whitespace-pre-wrap text-[var(--text-primary)]">
                  {{ customer?.remark || '-' }}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- 历史订单 -->
        <div v-if="currentTab === 'orders'" class="space-y-4">
          <div v-if="loadingOrders" class="py-8 text-center">
            <div
              class="border-primary mx-auto size-8 animate-spin rounded-full border-b-2"
            ></div>
          </div>

          <div v-else-if="orders.length === 0" class="py-8 text-center text-[var(--text-secondary)]">
            <svg
              class="mx-auto size-12 text-[var(--text-secondary)] opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p class="mt-2 text-sm">{{ t('customer.detail.noOrders') }}</p>
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="order in orders"
              :key="order.id"
              class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3 transition-shadow hover:shadow-sm"
            >
              <div class="mb-2 flex items-start justify-between">
                <div>
                  <p class="text-sm font-medium text-[var(--text-primary)]">{{ order.productName }}</p>
                  <p class="text-xs text-[var(--text-secondary)]">
                    {{ order.orderNo }} • {{ formatDate(order.createdAt) }}
                  </p>
                </div>
                <StatusBadge :status="order.status" class="origin-right scale-90" />
              </div>
              <div class="mt-2 flex gap-2 border-t border-[var(--border-color)] pt-2 text-xs text-[var(--text-secondary)]">
                <img
                  v-if="order.mainImage"
                  :src="order.mainImage"
                  class="size-12 rounded object-cover"
                />
                <div class="flex flex-1 flex-col justify-center">
                  <p>{{ t('common.salesperson') }}: {{ order.salespersonName || '-' }}</p>
                  <p class="mt-1 font-medium text-[var(--text-primary)]">
                    {{ formatCurrency(order.totalAmount, order.currency) }}
                  </p>
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
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { API } from '@/utils/constants';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const props = defineProps({
  customer: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close', 'refresh', 'edit']);

const { t } = useI18n();
const { addToast } = useToast();

const currentTab = ref('info');
const orders = ref([]);
const loadingOrders = ref(false);

const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

const tabs = computed(() => [
  { key: 'info', name: t('customer.form.basicInfo') },
  { key: 'orders', name: t('customer.detail.historyOrders') },
]);


const loadOrders = async () => {
  if (!props.customer?.id) return;

  loadingOrders.value = true;
  try {
    const res = await fetch(API.MANAGE_CUSTOMER_ORDERS(props.customer.id));
    const result = await res.json();
    if (result.success) {
      orders.value = result.data;
    }
  } catch (_e) {
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
    onConfirm: confirmDelete,
  };
};

const confirmDelete = async () => {
  if (!props.customer?.id) return;

  confirmData.value.loading = true;
  try {
    const res = await fetch(`${API.MANAGE_CUSTOMER}/${props.customer.id}`, {
      method: 'DELETE',
    });
    const result = await res.json();

    if (result.success) {
      addToast({ message: t('common.deleteSuccess'), type: 'success' });
      confirmData.value.show = false;
      emit('close');
      emit('refresh');
    } else {
      addToast({ message: result.message, type: 'error' });
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    confirmData.value.loading = false;
  }
};

watch(currentTab, (newTab) => {
  if (newTab === 'orders' && orders.value.length === 0) {
    loadOrders();
  }
});

watch(
  () => props.customer?.id,
  (newId) => {
    if (newId){
         // Reset on customer change
         currentTab.value = 'info';
         orders.value = [];
    }
  }
);
</script>
