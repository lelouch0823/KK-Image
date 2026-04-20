<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h4 class="text-sm font-semibold text-(--text-main)">
          {{ t('order.form.multilineTitle', '订单明细') }}
        </h4>
        <p class="text-xs text-(--text-secondary)">
          {{ t('order.form.multilineSubtitle', '每条商品独立绑定，提交前自动汇总总件数') }}
        </p>
      </div>
      <AppButton
        type="button"
        variant="secondary"
        size="sm"
        data-testid="add-order-line"
        @click="$emit('add-line')"
      >
        {{ t('order.form.addLine', '新增明细') }}
      </AppButton>
    </div>

    <div class="space-y-4">
      <OrderLineEditor
        v-for="(line, index) in modelValue"
        :key="line.clientId || index"
        :model-value="line"
        :index="index"
        :state="lineStates[index]"
        :can-remove="modelValue.length > 1"
        @update:model-value="$emit('update-line', index, $event)"
        @remove="$emit('remove-line', index)"
        @copy="$emit('copy-line', index)"
        @add-after="$emit('add-line-after', index)"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import OrderLineEditor from './OrderLineEditor.vue';

defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  lineStates: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['add-line', 'add-line-after', 'copy-line', 'remove-line', 'update-line']);
const { t } = useI18n();
</script>
