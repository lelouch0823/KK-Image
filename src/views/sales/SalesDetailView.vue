<template>
  <div :data-sales-order-mode="salesOrderEntry">
    <div v-if="loading" class="flex h-64 items-center justify-center">
      <div class="size-8 animate-spin rounded-full border-4 border-(--border-color) border-t-primary"></div>
    </div>
    <OrderDetail
      v-else-if="order"
      :order="order"
      mode="sales"
      :comment-error="commentError"
      :pending-comment="pendingComment"
      :comment-clear-key="commentClearKey"
      @back="handleBack"
      @comment="handleComment"
      @refresh="handleRefresh"
      @duplicate="handleDuplicate"
    />
    <AsyncStatePanel
      v-else-if="detailError"
      state="error"
      :description="detailError"
      @retry="fetchOrder"
    />
    <div v-else class="flex h-screen items-center justify-center">
      <EmptyState
        icon="search"
        :title="t('common.orderNotFound')"
        :description="t('common.orderNotFoundDesc')"
      >
        <template #action>
          <router-link
            :to="`/sales/${token}`"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-(--text-inverse) transition-all hover:bg-(--color-primary-hover) active:scale-95"
          >
            {{ t('order.detail.backToList') || '返回列表' }}
          </router-link>
        </template>
      </EmptyState>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useOrders } from '@/composables/useOrders';
import { useI18n } from '@/composables/useI18n'; // Assuming simple t function or similar
import OrderDetail from '@/components/order/OrderDetail.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import AsyncStatePanel from '@/components/common/AsyncStatePanel.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n(); // You might need to adjust based on your useI18n implementation

const token = computed(() => route.params.token);
const orderId = computed(() => route.params.id);

// We use useOrders locally for single order fetching, 
// OR we could use the one injected if we want to share cache, 
// but Detail often needs fresh data.
const { getSalesOrder, addSalesComment } = useOrders();

const order = ref(null);
const loading = ref(true);
const detailError = ref('');
const commentError = ref('');
const pendingComment = ref('');
const commentClearKey = ref(0);

// Inject for shared actions if needed, e.g. causing a list refresh
const salesContext = inject('salesContext', {});
const {
  loadOrders = async () => {},
  setPrefillData = () => {},
  salesOrderMode = ref('legacy'),
} = salesContext;
const salesOrderEntry = computed(() => salesOrderMode.value || 'legacy');

const fetchOrder = async () => {
  loading.value = true;
  detailError.value = '';
  try {
    const data = await getSalesOrder(token.value, orderId.value);
    if (data) {
      order.value = data;
    } else {
      order.value = null;
      detailError.value = t('common.loadFailed');
    }
  } finally {
    loading.value = false;
  }
};

const handleBack = () => {
  router.push(`/sales/${token.value}`);
};

const handleComment = async (comment) => {
  if (!order.value) return;
  pendingComment.value = comment;
  const success = await addSalesComment(token.value, order.value.id, comment);
  if (success) {
    commentError.value = '';
    commentClearKey.value += 1;
    await fetchOrder();
  } else {
    commentError.value = t('common.loadFailed');
  }
};

const handleRefresh = async () => {
  await fetchOrder();
  // Optionally refresh the list in background
  if (loadOrders) loadOrders();
};

const handleDuplicate = (sourceOrder) => {
    // Logic extracted from Sales.vue
    const currentData = sourceOrder.currentData || {};
    const prefillFiles = (sourceOrder.files || []).map((f) => ({
        id: f.id,
        name: f.name,
        url: f.url,
        mimeType: f.mimeType,
        size: f.size,
        isLocal: false,
    }));

    const prefill = {
        name: currentData.name || '',
        brand: currentData.brand || '',
        series: currentData.series || '',
        size: currentData.size || '',
        color: currentData.color || '',
        material: currentData.material || '',
        quantity: currentData.quantity || 1,
        remark: currentData.remark || '',
        deadline: '', 
        files: prefillFiles,
    };

    // Use setter from context
    if (setPrefillData) {
        setPrefillData(prefill);
        router.push(`/sales/${token.value}/create`);
    }
};

onMounted(() => {
  fetchOrder();
});
</script>
