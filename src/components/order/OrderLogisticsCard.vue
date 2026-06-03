<template>
  <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-primary text-sm font-medium">
        {{ t('order.logistics.title', '物流跟踪') }}
      </h3>
      <AppButton
        v-if="mode === 'admin'"
        variant="ghost"
        size="sm"
        @click="showEditForm = !showEditForm"
      >
        <template #icon-left>
          <AppIcon name="pencil" class="size-4" />
        </template>
        {{ showEditForm ? t('common.cancel') : t('common.edit') }}
      </AppButton>
    </div>

    <!-- 物流信息编辑表单 (仅管理员) -->
    <div v-if="showEditForm && mode === 'admin'" class="mb-4 space-y-3 rounded-xl border border-(--border-color) p-3">
      <div class="space-y-1">
        <label class="text-secondary text-xs font-medium">
          {{ t('order.logistics.carrier', '快递公司') }}
        </label>
        <select
          v-model="editForm.carrier"
          class="bg-(--bg-input) border-(--border-color) text-primary w-full rounded-lg border px-3 py-2 text-sm"
        >
          <option
            v-for="c in carriers"
            :key="c.code"
            :value="c.code"
          >
            {{ c.name }}
          </option>
        </select>
      </div>
      <div class="space-y-1">
        <label class="text-secondary text-xs font-medium">
          {{ t('order.logistics.trackingNo', '运单号') }}
        </label>
        <AppInput
          v-model="editForm.trackingNo"
          :placeholder="t('order.logistics.trackingNoPlaceholder', '输入运单号')"
        />
      </div>
      <AppButton
        variant="primary"
        size="sm"
        :loading="saving"
        @click="saveLogistics"
      >
        {{ t('common.save') }}
      </AppButton>
    </div>

    <!-- 无物流信息 -->
    <div v-if="!trackingNo && !showEditForm" class="py-4 text-center">
      <AppIcon name="truck" class="mx-auto mb-2 size-8 text-(--text-tertiary)" />
      <p class="text-sm text-(--text-secondary)">
        {{ t('order.logistics.noTracking', '暂无物流信息') }}
      </p>
      <p v-if="mode === 'admin'" class="mt-1 text-xs text-(--text-tertiary)">
        {{ t('order.logistics.clickToSet', '点击编辑按钮添加运单号') }}
      </p>
    </div>

    <!-- 物流轨迹时间线 -->
    <div v-if="trackingNo && !showEditForm">
      <div class="mb-3 flex items-center gap-2">
        <span class="text-secondary text-xs">
          {{ carrierName }} · {{ trackingNo }}
        </span>
        <AppButton
          variant="link"
          size="sm"
          @click="refreshTracking"
        >
          {{ t('common.refresh') }}
        </AppButton>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-6">
        <div class="size-5 animate-spin rounded-full border-2 border-(--border-color) border-t-(--color-primary)" />
      </div>

      <div v-else-if="trackingEvents.length === 0" class="py-4 text-center">
        <p class="text-sm text-(--text-secondary)">
          {{ t('order.logistics.noEvents', '暂无轨迹信息') }}
        </p>
      </div>

      <div v-else class="relative space-y-0">
        <div
          v-for="(event, index) in trackingEvents"
          :key="event.id"
          class="relative flex gap-3 pb-4 last:pb-0"
        >
          <!-- 连接线 -->
          <div
            v-if="index < trackingEvents.length - 1"
            class="absolute top-5 left-[7px] h-full w-px bg-(--border-color)"
          />

          <!-- 状态圆点 -->
          <div
            class="relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2"
            :class="index === 0
              ? 'border-(--color-primary) bg-(--color-primary)'
              : 'border-(--border-color) bg-(--bg-card)'"
          />

          <!-- 内容 -->
          <div class="min-w-0 flex-1">
            <p
              class="text-sm font-medium"
              :class="index === 0 ? 'text-(--text-main)' : 'text-(--text-secondary)'"
            >
              {{ event.statusText }}
            </p>
            <p class="mt-0.5 text-xs text-(--text-tertiary)">
              {{ event.description }}
            </p>
            <div class="mt-1 flex items-center gap-2 text-xs text-(--text-tertiary)">
              <span>{{ formatDate(event.timestamp) }}</span>
              <span v-if="event.location">· {{ event.location }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import { formatDate } from '@/utils/formatters';

const props = defineProps({
  orderId: { type: String, required: true },
  mode: { type: String, default: 'admin' },
  initialTrackingNo: { type: String, default: '' },
  initialCarrier: { type: String, default: 'express' },
});

const emit = defineEmits(['logistics-updated']);

const { t } = useI18n();
const { addToast } = useToast();
const { authFetch } = useAuth();

const trackingNo = ref(props.initialTrackingNo);
const carrier = ref(props.initialCarrier);
const trackingEvents = ref([]);
const carriers = ref([]);
const loading = ref(false);
const saving = ref(false);
const showEditForm = ref(false);

const editForm = ref({
  trackingNo: props.initialTrackingNo,
  carrier: props.initialCarrier,
});

const carrierName = computed(() => {
  const found = carriers.value.find(c => c.code === carrier.value);
  return found?.name || carrier.value;
});


async function loadTracking() {
  if (!props.orderId) return;
  loading.value = true;
  try {
    const response = await authFetch(`/api/manage/orders/${props.orderId}/logistics`);
    const res = await response.json();
    if (res.success) {
      trackingNo.value = res.data.trackingNo;
      carrier.value = res.data.carrier;
      trackingEvents.value = res.data.tracking?.events || [];
      carriers.value = res.data.carriers || [];
    }
  } catch (_err) {
    console.error('加载物流信息失败:', _err);
  } finally {
    loading.value = false;
  }
}

async function refreshTracking() {
  await loadTracking();
}

async function saveLogistics() {
  saving.value = true;
  try {
    const response = await authFetch(`/api/manage/orders/${props.orderId}/logistics`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNo: editForm.value.trackingNo,
        carrier: editForm.value.carrier,
      }),
    });
    const res = await response.json();
    if (res.success) {
      trackingNo.value = editForm.value.trackingNo;
      carrier.value = editForm.value.carrier;
      showEditForm.value = false;
      await loadTracking();
      emit('logistics-updated');
      addToast(t('order.logistics.saveSuccess', '物流信息已更新'), 'success');
    }
  } catch (_err) {
    addToast(t('order.logistics.saveFailed', '保存物流信息失败'), 'error');
  } finally {
    saving.value = false;
  }
}

watch(() => props.initialTrackingNo, (val) => {
  trackingNo.value = val;
  editForm.value.trackingNo = val;
});

watch(() => props.initialCarrier, (val) => {
  carrier.value = val;
  editForm.value.carrier = val;
});

onMounted(() => {
  loadTracking();
});
</script>
