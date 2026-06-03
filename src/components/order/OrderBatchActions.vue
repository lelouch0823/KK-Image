<template>
  <FloatingSelectionBar :visible="selectedCount > 0">
    <template #summary>
      <span class="text-primary text-sm font-medium">
        {{ t('order.manage.selectedCount', { count: selectedCount }) }}
      </span>
      <AppButton
        variant="link"
        size="sm"
        @click="$emit('cancel')"
      >
        {{ t('order.manage.cancelSelect') }}
      </AppButton>
    </template>

    <!-- 批量确认 -->
    <AppButton
      :disabled="processing"
      class="shadow-primary/10 shadow-lg"
      @click="$emit('action', 'confirm')"
    >
      <template #icon-left>
        <AppIcon name="check" class="size-4.5" />
      </template>
      {{ t('order.manage.batchConfirm') }}
    </AppButton>

    <!-- 批量驳回 -->
    <AppButton
      :disabled="processing"
      variant="outline"
      class="border-warning/30 bg-warning/10 text-warning shadow-warning/10 hover:border-warning/40 hover:bg-warning/15 hover:text-warning shadow-lg"
      @click="$emit('action', 'reject')"
    >
      <template #icon-left>
        <AppIcon name="x-mark" class="size-4.5" />
      </template>
      {{ t('order.manage.batchReject') }}
    </AppButton>

    <!-- 批量作废 -->
    <AppButton
      variant="danger"
      :disabled="processing"
      class="shadow-danger/10 shadow-lg"
      @click="$emit('action', 'void')"
    >
      <template #icon-left>
        <AppIcon name="trash" class="size-4" />
      </template>
      {{ t('order.manage.batchVoid') }}
    </AppButton>

    <!-- 分隔线 -->
    <div class="h-6 w-px bg-(--border-color)" />

    <!-- 批量变更状态下拉 -->
    <div ref="statusDropdownRef" class="relative">
      <AppButton
        variant="outline"
        :disabled="processing"
        class="shadow-lg"
        @click="showStatusDropdown = !showStatusDropdown"
      >
        <template #icon-left>
          <AppIcon name="arrows-up-down" class="size-4" />
        </template>
        {{ t('order.manage.batchChangeStatus') }}
        <template #icon-right>
          <AppIcon name="chevron-down" class="size-3" />
        </template>
      </AppButton>

      <!-- 下拉菜单 -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showStatusDropdown"
          class="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-(--border-color) bg-(--bg-card) py-1 shadow-xl"
        >
          <AppButton
            v-for="statusOption in statusOptions"
            :key="statusOption.value"
            variant="ghost"
            size="sm"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-hover)"
            :class="{ 'text-(--text-muted)': statusOption.disabled }"
            :disabled="statusOption.disabled"
            @click="handleStatusSelect(statusOption.value)"
          >
            <span
              class="size-2 rounded-full"
              :class="statusOption.colorClass"
            />
            {{ statusOption.label }}
          </AppButton>
        </div>
      </Transition>
    </div>

    <!-- 批量导出 -->
    <AppButton
      variant="ghost"
      :disabled="processing || exporting"
      class="shadow-lg"
      @click="$emit('action', 'export')"
    >
      <template #icon-left>
        <AppIcon
          :name="exporting ? 'spinner' : 'document-arrow-down'"
          :class="['size-4', { 'animate-spin': exporting }]"
        />
      </template>
      {{ t('order.manage.batchExport') }}
    </AppButton>

    <!-- 批量打印 -->
    <AppButton
      variant="ghost"
      :disabled="processing"
      class="shadow-lg"
      @click="$emit('action', 'print')"
    >
      <template #icon-left>
        <AppIcon name="printer" class="size-4" />
      </template>
      {{ t('order.manage.batchPrint') }}
    </AppButton>
  </FloatingSelectionBar>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import FloatingSelectionBar from '@/design-system/composed/FloatingSelectionBar.vue';

const props = defineProps({
  selectedCount: {
    type: Number,
    default: 0,
  },
  processing: {
    type: Boolean,
    default: false,
  },
  exporting: {
    type: Boolean,
    default: false,
  },
  statuses: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['action', 'cancel', 'changeStatus']);

const { t } = useI18n();

const showStatusDropdown = ref(false);
const statusDropdownRef = ref(null);

// 状态选项（带颜色标识）
const statusOptions = computed(() => {
  const colorMap = {
    pending: 'bg-(--color-warning)',
    confirmed: 'bg-(--color-primary)',
    production: 'bg-(--color-info)',
    shipping: 'bg-(--color-primary)',
    arrived: 'bg-(--color-success)',
    fulfilled: 'bg-(--color-success)',
    delivered: 'bg-(--color-success)',
    void: 'bg-(--color-danger)',
  };

  // 如果有从 API 返回的状态列表，使用它；否则使用默认列表
  const statusList = props.statuses.length > 0
    ? props.statuses
    : [
        { value: 'pending', label: t('order.statuses.pending') },
        { value: 'confirmed', label: t('order.statuses.confirmed') },
        { value: 'production', label: t('order.statuses.production') },
        { value: 'shipping', label: t('order.statuses.shipping') },
        { value: 'arrived', label: t('order.statuses.arrived') },
        { value: 'fulfilled', label: t('order.statuses.fulfilled') },
        { value: 'delivered', label: t('order.statuses.delivered') },
        { value: 'void', label: t('order.statuses.void') },
      ];

  return statusList.map(s => ({
    ...s,
    colorClass: colorMap[s.value] || 'bg-(--bg-muted)',
    disabled: false,
  }));
});

const handleStatusSelect = (status) => {
  showStatusDropdown.value = false;
  emit('changeStatus', status);
};

// 点击外部关闭下拉菜单
const handleClickOutside = (event) => {
  if (statusDropdownRef.value && !statusDropdownRef.value.contains(event.target)) {
    showStatusDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
