<template>
  <div class="flex h-full flex-col bg-(--bg-card)">
    <!-- 头部 -->
    <div class="border-b border-(--border-color) px-4 py-6 sm:px-6">
      <div class="flex items-start justify-between">
        <h2 id="slide-over-title" class="text-lg font-medium text-(--text-primary)">
          {{ customer?.name }}
        </h2>
        <div class="ml-3 flex h-7 items-center">
          <AppButton variant="ghost" size="sm" class="!px-2" @click="$emit('close')">
            <template #icon-left>
              <AppIcon name="x-mark" class="size-5" />
            </template>
          </AppButton>
        </div>
      </div>
      <div class="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:space-x-6">
        <div class="mt-2 text-sm text-(--text-secondary)">
          <span class="mr-1 font-medium">{{ t('customer.form.company') }}:</span>
          {{ customer?.company || '-' }}
        </div>
        <div class="mt-2 text-sm text-(--text-secondary)">
          <span class="mr-1 font-medium">{{ t('customer.form.phone') }}:</span>
          {{ customer?.phone || '-' }}
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="relative flex-1 overflow-y-auto">
      <!-- Tabs -->
      <div class="border-b border-(--border-color)">
        <nav class="-mb-px flex px-6" aria-label="Tabs">
          <AppButton
            v-for="tab in tabs"
            :key="tab.key"
            variant="link"
            class="mr-6 !rounded-none border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap no-underline transition-colors"
            :class="
              currentTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-(--text-secondary) hover:border-(--border-hover) hover:text-(--text-main)'
            "
            @click="currentTab = tab.key"
          >
            {{ tab.name }}
          </AppButton>
        </nav>
      </div>

      <!-- Tab Panels -->
      <div class="p-6">
        <!-- 基本信息 -->
        <div v-if="currentTab === 'info'" class="space-y-6">
          <!-- 操作栏 -->
          <ActionBar class="border-none bg-transparent px-0 py-0 shadow-none">
            <AppButton variant="white" :text="t('common.edit')" @click="$emit('edit', customer)">
              <template #icon-left>
                <AppIcon name="pencil-square" class="size-4" />
              </template>
            </AppButton>
            <AppButton variant="danger" :text="t('common.delete')" @click="handleDelete">
              <template #icon-left>
                <AppIcon name="trash" class="size-4" />
              </template>
            </AppButton>
          </ActionBar>

          <AppCard padding="p-5">
            <template #header>
              <h4 class="text-sm font-medium text-(--text-secondary)">
                {{ t('customer.form.basicInfo') }}
              </h4>
            </template>
            <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="sm:col-span-1">
                <dt class="text-xs font-medium text-(--text-secondary)">
                  {{ t('customer.form.phone') }}
                </dt>
                <dd class="mt-1 text-sm text-(--text-primary)">{{ customer?.phone || '-' }}</dd>
              </div>
              <div class="sm:col-span-1">
                <dt class="text-xs font-medium text-(--text-secondary)">
                  {{ t('common.createdAt') }}
                </dt>
                <dd class="mt-1 text-sm text-(--text-primary)">
                  {{ formatDate(customer?.createdAt) }}
                </dd>
              </div>

              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-(--text-secondary)">
                  {{ t('customer.form.tags') }}
                </dt>
                <dd class="mt-1 flex flex-wrap gap-2 text-sm text-(--text-primary)">
                  <span
                    v-for="tag in customer?.tags"
                    :key="tag"
                    class="text-primary rounded bg-(--color-primary-bg) px-2 py-0.5 text-xs font-medium"
                  >
                    {{ tag }}
                  </span>
                  <span v-if="!customer?.tags?.length" class="text-(--text-secondary)">-</span>
                </dd>
              </div>

              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-(--text-secondary)">
                  {{ t('customer.form.email') }}
                </dt>
                <dd class="mt-1 text-sm text-(--text-primary)">{{ customer?.email || '-' }}</dd>
              </div>

              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-(--text-secondary)">
                  {{ t('customer.form.address') }}
                </dt>
                <dd class="mt-1 text-sm text-(--text-primary)">{{ customer?.address || '-' }}</dd>
              </div>

              <div class="sm:col-span-2">
                <dt class="text-xs font-medium text-(--text-secondary)">
                  {{ t('customer.form.remark') }}
                </dt>
                <dd class="mt-1 text-sm whitespace-pre-wrap text-(--text-primary)">
                  {{ customer?.remark || '-' }}
                </dd>
              </div>
            </dl>
          </AppCard>
        </div>

        <!-- 历史订单 -->
        <div v-if="currentTab === 'orders'" class="space-y-4">
          <div v-if="loadingOrders" class="py-8 text-center">
            <AppIcon name="spinner" class="text-primary mx-auto size-8 animate-spin" />
          </div>

          <EmptyState
            v-else-if="orders.length === 0"
            icon="inbox"
            :title="t('customer.detail.noOrders')"
            :description="t('customer.detail.noOrders')"
            size="sm"
          />

          <div v-else class="space-y-4">
            <AppCard v-for="order in orders" :key="order.id" padding="p-4">
              <div class="mb-2 flex items-start justify-between">
                <div>
                  <p class="text-sm font-medium text-(--text-primary)">{{ order.productName }}</p>
                  <p class="text-xs text-(--text-secondary)">
                    {{ order.orderNo }} • {{ formatDate(order.createdAt) }}
                  </p>
                </div>
                <StatusBadge :status="order.status" class="origin-right scale-90" />
              </div>
              <div
                class="mt-2 flex gap-2 border-t border-(--border-color) pt-2 text-xs text-(--text-secondary)"
              >
                <AppImage
                  v-if="order.mainImage"
                  :src="order.mainImage"
                  :blurhash="order.mainImageBlurhash"
                  class="size-12"
                  fit="cover"
                  rounded="sm"
                />
                <div class="flex flex-1 flex-col justify-center">
                  <p>{{ t('common.salesperson') }}: {{ order.salespersonName || '-' }}</p>
                  <p class="mt-1 font-medium text-(--text-primary)">
                    {{ formatCurrency(order.totalAmount, order.currency) }}
                  </p>
                </div>
              </div>
            </AppCard>
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
import { useAuth } from '@/composables/useAuth';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { API } from '@/utils/constants';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  customer: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close', 'refresh', 'edit']);

const { t } = useI18n();
const { addToast } = useToast();
const { authFetch } = useAuth();

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
    const res = await authFetch(API.MANAGE_CUSTOMER_ORDERS(props.customer.id));
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
    const res = await authFetch(`${API.MANAGE_CUSTOMER}/${props.customer.id}`, {
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
    if (newId) {
      // Reset on customer change
      currentTab.value = 'info';
      orders.value = [];
    }
  }
);
</script>
