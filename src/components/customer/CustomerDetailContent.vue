<template>
  <div class="flex h-full flex-col bg-(--bg-card)">
    <!-- 头部 -->
    <div class="border-b border-(--border-color) px-4 py-6 sm:px-6">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h2 id="slide-over-title" class="text-lg font-medium text-(--text-primary)">
              {{ customer?.name }}
            </h2>
            <!-- RFM 分段徽章 -->
            <StatusBadge
              v-if="stats?.segment"
              :variant="segmentVariant"
              dot
            >
              {{ t(`customer.detail.segment${segmentLabel}`) }}
            </StatusBadge>
          </div>
          <p v-if="stats?.segment" class="mt-0.5 text-xs text-(--text-secondary)">
            {{ t(`customer.detail.segment${segmentLabel}Desc`) }}
          </p>
        </div>
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
        <!-- 概览 Tab -->
        <div v-if="currentTab === 'overview'" class="space-y-6">
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

          <!-- 统计卡片 -->
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile
              :label="t('customer.detail.orderCount')"
              :value="stats?.orderCount ?? '-'"
              icon="shopping-bag"
              tone="primary"
              flat
            />
            <MetricTile
              :label="t('customer.detail.lastOrder')"
              :value="stats?.lastOrderAt ? formatRecency(stats.recencyDays) : '-'"
              icon="clock"
              tone="info"
              flat
            />
            <MetricTile
              :label="t('customer.detail.firstOrder')"
              :value="stats?.firstOrderAt ? formatDate(stats.firstOrderAt) : '-'"
              icon="calendar"
              tone="success"
              flat
            />
            <MetricTile
              :label="t('customer.detail.segment')"
              :value="t(`customer.detail.segment${segmentLabel}`)"
              :icon="segmentIcon"
              :tone="segmentVariant"
              flat
            />
          </div>

          <!-- 基本信息 -->
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

          <!-- 常购商品 -->
          <AppCard v-if="stats?.favoriteProducts?.length" padding="p-5">
            <template #header>
              <h4 class="text-sm font-medium text-(--text-secondary)">
                {{ t('customer.detail.favoriteProducts') }}
              </h4>
            </template>
            <div class="space-y-2">
              <div
                v-for="product in stats.favoriteProducts"
                :key="product.productId"
                class="flex items-center justify-between rounded-lg bg-(--bg-muted) px-3 py-2"
              >
                <span class="text-sm text-(--text-main)">{{ product.productName || '-' }}</span>
                <span class="text-xs font-medium text-(--text-secondary)">
                  {{ t('customer.detail.orderCountValue', { count: product.orderCount }) }}
                </span>
              </div>
            </div>
          </AppCard>

          <!-- 最近订单 -->
          <AppCard padding="p-5">
            <template #header>
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium text-(--text-secondary)">
                  {{ t('customer.detail.historyOrders') }}
                </h4>
                <AppButton
                  v-if="recentOrders.length > 0"
                  variant="link"
                  size="sm"
                  @click="currentTab = 'orders'"
                >
                  {{ t('common.viewAll') }}
                </AppButton>
              </div>
            </template>

            <div v-if="loadingOrders" class="py-4 text-center">
              <AppIcon name="spinner" class="text-primary mx-auto size-6 animate-spin" />
            </div>

            <EmptyState
              v-else-if="recentOrders.length === 0"
              icon="inbox"
              :title="t('customer.detail.noOrders')"
              size="sm"
            />

            <div v-else class="space-y-3">
              <div
                v-for="order in recentOrders"
                :key="order.id"
                class="flex items-center justify-between rounded-lg border border-(--border-color) px-3 py-2"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-(--text-main)">{{ order.productName }}</p>
                  <p class="text-xs text-(--text-secondary)">
                    {{ order.orderNo }} - {{ formatDate(order.createdAt) }}
                  </p>
                </div>
                <StatusBadge :status="order.status" class="ml-2 origin-right scale-90" />
              </div>
            </div>
          </AppCard>
        </div>

        <!-- 历史订单 Tab -->
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
                    {{ order.orderNo }} - {{ formatDate(order.createdAt) }}
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
                  :alt="order.name || order.orderNo"
                  :blurhash="order.mainImageBlurhash"
                  class="size-12"
                  fit="cover"
                  rounded="sm"
                />
                <div class="flex flex-1 flex-col justify-center">
                  <p>{{ t('common.salesperson') }}: {{ order.salespersonName || '-' }}</p>
                  <p v-if="order.quantity" class="mt-1">
                    {{ t('common.quantity') }}: {{ order.quantity }}
                  </p>
                </div>
              </div>
            </AppCard>
          </div>
        </div>

        <!-- 标签管理 Tab -->
        <div v-if="currentTab === 'tags'" class="space-y-4">
          <!-- 添加标签 -->
          <div class="flex gap-2">
            <input
              v-model="newTagName"
              type="text"
              :placeholder="t('customer.detail.tagInputPlaceholder')"
              class="flex-1 rounded-lg border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) placeholder-(--text-muted) focus:border-(--color-primary) focus:outline-none focus:ring-1 focus:ring-(--color-primary)"
              @keydown.enter="handleAddTag"
            />
            <AppButton
              variant="primary"
              size="sm"
              :disabled="!newTagName.trim() || addingTag"
              @click="handleAddTag"
            >
              <template #icon-left>
                <AppIcon
                  v-if="addingTag"
                  name="spinner"
                  class="size-4 animate-spin"
                />
                <AppIcon v-else name="plus" class="size-4" />
              </template>
              {{ t('customer.detail.addTag') }}
            </AppButton>
          </div>

          <!-- 标签列表 -->
          <div v-if="loadingTags" class="py-4 text-center">
            <AppIcon name="spinner" class="text-primary mx-auto size-6 animate-spin" />
          </div>

          <EmptyState
            v-else-if="detailTags.length === 0"
            icon="tag"
            :title="t('common.empty')"
            size="sm"
          />

          <div v-else class="space-y-2">
            <div
              v-for="tag in detailTags"
              :key="tag.id"
              class="flex items-center justify-between rounded-lg border border-(--border-color) px-3 py-2"
            >
              <div class="flex items-center gap-2">
                <AppIcon name="tag" class="size-4 text-(--text-secondary)" />
                <span class="text-sm text-(--text-main)">{{ tag.name }}</span>
              </div>
              <AppButton
                variant="ghost"
                size="sm"
                class="!px-1.5"
                @click="handleRemoveTag(tag.name)"
              >
                <template #icon-left>
                  <AppIcon name="x-mark" class="size-4 text-(--text-muted)" />
                </template>
              </AppButton>
            </div>
          </div>

          <!-- 常用标签推荐 -->
          <div v-if="allTags.length > 0" class="border-t border-(--border-color) pt-4">
            <p class="mb-2 text-xs font-medium text-(--text-secondary)">
              {{ t('customer.form.tags') }}
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tag in suggestedTags"
                :key="tag.name"
                class="rounded-full border border-(--border-color) px-3 py-1 text-xs text-(--text-secondary) transition-colors hover:border-(--color-primary) hover:text-(--color-primary)"
                @click="handleAddSuggestedTag(tag.name)"
              >
                {{ tag.name }}
                <span class="ml-1 text-(--text-muted)">({{ tag.usageCount }})</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 沟通记录 Tab -->
        <div v-if="currentTab === 'communications'" class="space-y-4">
          <!-- 添加沟通记录表单 -->
          <AppCard padding="p-4">
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <select
                  v-model="newCommType"
                  class="rounded-lg border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) focus:border-(--color-primary) focus:outline-none focus:ring-1 focus:ring-(--color-primary)"
                >
                  <option v-for="opt in commTypeOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <textarea
                v-model="newCommContent"
                :placeholder="t('customer.detail.communicationPlaceholder')"
                rows="3"
                class="w-full rounded-lg border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm text-(--text-main) placeholder-(--text-muted) focus:border-(--color-primary) focus:outline-none focus:ring-1 focus:ring-(--color-primary)"
              />
              <div class="flex justify-end">
                <AppButton
                  variant="primary"
                  size="sm"
                  :disabled="!newCommContent.trim() || addingComm"
                  @click="handleAddCommunication"
                >
                  <template #icon-left>
                    <AppIcon
                      v-if="addingComm"
                      name="spinner"
                      class="size-4 animate-spin"
                    />
                    <AppIcon v-else name="plus" class="size-4" />
                  </template>
                  {{ t('customer.detail.addCommunication') }}
                </AppButton>
              </div>
            </div>
          </AppCard>

          <!-- 加载中 -->
          <div v-if="loadingCommunications" class="py-8 text-center">
            <AppIcon name="spinner" class="text-primary mx-auto size-8 animate-spin" />
          </div>

          <!-- 空状态 -->
          <EmptyState
            v-else-if="communications.length === 0"
            icon="chat-bubble-left-right"
            :title="t('customer.detail.noCommunications')"
            size="sm"
          />

          <!-- 沟通记录列表 -->
          <div v-else class="space-y-3">
            <div
              v-for="comm in communications"
              :key="comm.id"
              class="relative rounded-lg border border-(--border-color) px-4 py-3"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="{
                      'bg-(--color-info-bg) text-(--color-info)': comm.type === 'note',
                      'bg-(--color-success-bg) text-(--color-success)': comm.type === 'call',
                      'bg-(--color-primary-bg) text-(--color-primary)': comm.type === 'email',
                      'bg-(--color-warning-bg) text-(--color-warning)': comm.type === 'meeting',
                      'bg-(--color-neutral-bg) text-(--color-neutral)': comm.type === 'wechat',
                    }"
                  >
                    <AppIcon :name="getCommTypeInfo(comm.type).icon" class="size-3" />
                    {{ getCommTypeInfo(comm.type).label }}
                  </span>
                  <span v-if="comm.created_by" class="text-xs text-(--text-secondary)">
                    {{ comm.created_by }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-(--text-muted)">
                    {{ formatDate(comm.created_at) }}
                  </span>
                  <AppButton
                    variant="ghost"
                    size="sm"
                    class="!px-1"
                    @click="handleDeleteCommunication(comm.id)"
                  >
                    <template #icon-left>
                      <AppIcon name="trash" class="size-3.5 text-(--text-muted)" />
                    </template>
                  </AppButton>
                </div>
              </div>
              <p class="mt-2 text-sm whitespace-pre-wrap text-(--text-main)">{{ comm.content }}</p>
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
import { useAuth } from '@/composables/useAuth';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { API } from '@/utils/constants';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import MetricTile from '@/design-system/composed/MetricTile.vue';
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

const currentTab = ref('overview');
const orders = ref([]);
const loadingOrders = ref(false);
const stats = ref(null);
const loadingStats = ref(false);
const detailTags = ref([]);
const loadingTags = ref(false);
const allTags = ref([]);
const newTagName = ref('');
const addingTag = ref(false);

// 沟通记录相关
const communications = ref([]);
const loadingCommunications = ref(false);
const commTotal = ref(0);
const newCommType = ref('note');
const newCommContent = ref('');
const addingComm = ref(false);

const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

const tabs = computed(() => [
  { key: 'overview', name: t('customer.detail.overview') },
  { key: 'orders', name: t('customer.detail.historyOrders') },
  { key: 'tags', name: t('customer.detail.tags') },
  { key: 'communications', name: t('customer.detail.communications') },
]);

// RFM 分段相关计算属性
const segmentLabel = computed(() => {
  const map = { vip: 'Vip', active: 'Active', 'at-risk': 'AtRisk', lost: 'Lost', new: 'New' };
  return map[stats.value?.segment] || 'New';
});

const segmentVariant = computed(() => {
  const map = { vip: 'warning', active: 'success', 'at-risk': 'danger', lost: 'neutral', new: 'info' };
  return map[stats.value?.segment] || 'info';
});

const segmentIcon = computed(() => {
  const map = { vip: 'star', active: 'check-circle', 'at-risk': 'exclamation-triangle', lost: 'x-circle', new: 'user' };
  return map[stats.value?.segment] || 'user';
});

// 最近订单（概览中显示前 3 条）
const recentOrders = computed(() => orders.value.slice(0, 3));

// 推荐标签（排除已有的）
const suggestedTags = computed(() => {
  const existingNames = new Set(detailTags.value.map((t) => t.name));
  return allTags.value.filter((t) => !existingNames.has(t.name)).slice(0, 10);
});

/**
 * 格式化距今天数
 */
const formatRecency = (days) => {
  if (days === null || days === undefined) return '-';
  if (days === 0) return t('common.today');
  return t('customer.detail.daysAgo', { days });
};

const loadStats = async () => {
  if (!props.customer?.id) return;
  loadingStats.value = true;
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_STATS(props.customer.id));
    const result = await res.json();
    if (result.success) {
      stats.value = result.data;
    }
  } catch (_e) {
    // 静默失败，统计不影响主功能
  } finally {
    loadingStats.value = false;
  }
};

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

const loadTags = async () => {
  if (!props.customer?.id) return;
  loadingTags.value = true;
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_TAGS(props.customer.id));
    const result = await res.json();
    if (result.success) {
      detailTags.value = result.data || [];
    }
  } catch (_e) {
    // 静默失败
  } finally {
    loadingTags.value = false;
  }
};

const loadAllTags = async () => {
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_ALL_TAGS);
    const result = await res.json();
    if (result.success) {
      allTags.value = result.data || [];
    }
  } catch (_e) {
    // 静默失败
  }
};

// 沟通记录
const commTypeOptions = computed(() => [
  { value: 'note', label: t('customer.detail.typeNote'), icon: 'document-text' },
  { value: 'call', label: t('customer.detail.typeCall'), icon: 'phone' },
  { value: 'email', label: t('customer.detail.typeEmail'), icon: 'envelope' },
  { value: 'meeting', label: t('customer.detail.typeMeeting'), icon: 'users' },
  { value: 'wechat', label: t('customer.detail.typeWechat'), icon: 'chat-bubble-left-right' },
]);

const getCommTypeInfo = (type) => {
  return commTypeOptions.value.find((o) => o.value === type) || commTypeOptions.value[0];
};

const loadCommunications = async () => {
  if (!props.customer?.id) return;
  loadingCommunications.value = true;
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_COMMUNICATIONS(props.customer.id));
    const result = await res.json();
    if (result.success) {
      communications.value = result.data || [];
      commTotal.value = result.pagination?.total || 0;
    }
  } catch (_e) {
    addToast({ message: t('common.loadFailed'), type: 'error' });
  } finally {
    loadingCommunications.value = false;
  }
};

const handleAddCommunication = async () => {
  if (addingComm.value || !newCommContent.value.trim()) return;
  addingComm.value = true;
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_COMMUNICATIONS(props.customer.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newCommType.value, content: newCommContent.value.trim() }),
    });
    const result = await res.json();
    if (result.success) {
      newCommContent.value = '';
      newCommType.value = 'note';
      await loadCommunications();
      addToast({ message: t('common.createSuccess'), type: 'success' });
    } else {
      addToast({ message: result.message || t('common.operationFailed'), type: 'error' });
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    addingComm.value = false;
  }
};

const handleDeleteCommunication = async (commId) => {
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_COMMUNICATION(props.customer.id, commId), {
      method: 'DELETE',
    });
    const result = await res.json();
    if (result.success) {
      communications.value = communications.value.filter((c) => c.id !== commId);
      commTotal.value--;
      addToast({ message: t('common.deleteSuccess'), type: 'success' });
    } else {
      addToast({ message: result.message || t('common.operationFailed'), type: 'error' });
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  }
};

const handleAddTag = async () => {
  if (addingTag.value || !newTagName.value.trim()) return;
  addingTag.value = true;
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_TAGS(props.customer.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: newTagName.value.trim() }),
    });
    const result = await res.json();
    if (result.success) {
      newTagName.value = '';
      await loadTags();
      emit('refresh');
      addToast({ message: t('common.createSuccess'), type: 'success' });
    } else {
      addToast({ message: result.message || t('common.operationFailed'), type: 'error' });
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  } finally {
    addingTag.value = false;
  }
};

const handleAddSuggestedTag = async (tagName) => {
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_TAGS(props.customer.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: tagName }),
    });
    const result = await res.json();
    if (result.success) {
      await loadTags();
      emit('refresh');
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
  }
};

const handleRemoveTag = async (tagName) => {
  try {
    const res = await authFetch(API.MANAGE_CUSTOMER_TAG(props.customer.id, tagName), {
      method: 'DELETE',
    });
    const result = await res.json();
    if (result.success) {
      detailTags.value = detailTags.value.filter((t) => t.name !== tagName);
      emit('refresh');
    } else {
      addToast({ message: result.message || t('common.operationFailed'), type: 'error' });
    }
  } catch (_e) {
    addToast({ message: t('common.networkError'), type: 'error' });
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

// Tab 切换时懒加载数据
watch(currentTab, (newTab) => {
  if (newTab === 'orders' && orders.value.length === 0) {
    loadOrders();
  }
  if (newTab === 'tags' && detailTags.value.length === 0) {
    loadTags();
    if (allTags.value.length === 0) {
      loadAllTags();
    }
  }
  if (newTab === 'communications' && communications.value.length === 0) {
    loadCommunications();
  }
});

// 客户切换时重置所有数据
watch(
  () => props.customer?.id,
  (newId) => {
    if (newId) {
      currentTab.value = 'overview';
      orders.value = [];
      stats.value = null;
      detailTags.value = [];
      newTagName.value = '';
      communications.value = [];
      commTotal.value = 0;
      newCommContent.value = '';
      newCommType.value = 'note';
      // 概览 tab 默认加载统计
      loadStats();
    }
  },
  { immediate: true }
);
</script>
