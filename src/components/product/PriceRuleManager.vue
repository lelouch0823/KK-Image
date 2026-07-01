<template>
  <div class="space-y-4">
    <div v-if="loading" class="flex items-center justify-center py-8">
      <AppIcon name="spinner" class="text-primary size-8 animate-spin" />
    </div>

    <template v-else>
      <div v-if="variants.length === 0" class="py-4 text-center text-sm text-(--text-muted)">
        {{ t('product.price_rules.no_variants', '请先添加商品变体') }}
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="variant in variants"
          :key="variant.id"
          class="rounded-lg border border-(--border-color) bg-(--bg-card) p-4"
        >
          <!-- 变体标题 -->
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-(--text-primary)">
                {{ formatVariantName(variant.options_values) }}
              </span>
              <span class="rounded bg-(--bg-muted) px-2 py-0.5 text-xs text-(--text-muted)">
                {{ variant.sku }}
              </span>
              <span class="text-xs text-(--text-muted)">
                {{ t('product.price_rules.base_price', '基础价') }}: {{ currencySymbol
                }}{{ formatPrice(variant.price) }}
              </span>
            </div>
            <AppButton
              variant="ghost"
              size="sm"
              class="!h-7 !px-2 text-xs"
              @click="addPriceRule(variant.id)"
            >
              <template #icon-left>
                <AppIcon name="plus" class="size-3.5" />
              </template>
              {{ t('product.price_rules.add', '添加价格') }}
            </AppButton>
          </div>

          <!-- 价格规则列表 -->
          <div v-if="getVariantRules(variant.id).length > 0" class="space-y-2">
            <div
              v-for="rule in getVariantRules(variant.id)"
              :key="rule.id || `${rule.variant_id}-${rule.price_type}`"
              class="flex items-center gap-3 rounded-md bg-(--bg-muted) p-3"
            >
              <!-- 价格类型 -->
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="getPriceTypeBadgeClass(rule.price_type)"
              >
                {{ getPriceTypeLabel(rule.price_type) }}
              </span>

              <!-- 价格输入 -->
              <div class="flex-1">
                <AppInput
                  :model-value="rule.price ?? ''"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  size="sm"
                  @update:model-value="(value) => updateRulePrice(rule, value)"
                >
                  <template #prepend>
                    <span class="text-xs text-(--text-muted)">{{ currencySymbol }}</span>
                  </template>
                </AppInput>
              </div>

              <!-- 生效日期 -->
              <div class="flex items-center gap-2">
                <AppInput
                  :model-value="formatDateForInput(rule.valid_from)"
                  type="date"
                  size="sm"
                  class="w-36"
                  :placeholder="t('product.price_rules.valid_from', '开始日期')"
                  @update:model-value="(value) => updateRuleValidFrom(rule, value)"
                />
                <span class="text-xs text-(--text-muted)">~</span>
                <AppInput
                  :model-value="formatDateForInput(rule.valid_to)"
                  type="date"
                  size="sm"
                  class="w-36"
                  :placeholder="t('product.price_rules.valid_to', '结束日期')"
                  @update:model-value="(value) => updateRuleValidTo(rule, value)"
                />
              </div>

              <!-- 删除按钮 -->
              <AppButton
                variant="ghost"
                size="sm"
                class="!h-7 !w-7 !px-0 text-danger hover:!bg-danger/10 hover:!text-danger"
                :title="t('common.delete', '删除')"
                @click="deleteRule(rule)"
              >
                <AppIcon name="trash" class="size-3.5" />
              </AppButton>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="py-2 text-center text-xs text-(--text-muted)">
            {{ t('product.price_rules.no_rules', '暂无价格规则，使用基础价格') }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { formatVariantName } from '@/utils/product';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import { formatReadableLabel } from '@/utils/event-display';

const { t } = useI18n();
const { addToast } = useToast();

const props = defineProps({
  productId: {
    type: String,
    required: true,
  },
  variants: {
    type: Array,
    default: () => [],
  },
  currencySymbol: {
    type: String,
    default: '¥',
  },
});

const emit = defineEmits(['update']);

const loading = ref(false);
const priceRules = ref({}); // { variantId: [rules] }

// 加载价格规则
const loadPriceRules = async () => {
  if (!props.productId) return;
  loading.value = true;
  try {
    const response = await fetch(`/api/manage/products/${props.productId}/prices`, {
      credentials: 'include',
    });
    if (response.ok) {
      const result = await response.json();
      priceRules.value = result.data || {};
    }
  } catch {
    // 加载价格规则失败，静默处理
  } finally {
    loading.value = false;
  }
};

// 获取变体的价格规则
const getVariantRules = (variantId) => {
  return priceRules.value[variantId] || [];
};

// 添加价格规则
const addPriceRule = (variantId) => {
  const existingRules = priceRules.value[variantId] || [];
  const usedTypes = existingRules.map((r) => r.price_type);
  const availableTypes = ['retail', 'wholesale', 'vip'].filter((t) => !usedTypes.includes(t));

  if (availableTypes.length === 0) {
    addToast({
      type: 'warning',
      message: t('product.price_rules.all_types_used', '已添加所有价格类型'),
    });
    return;
  }

  const newRule = {
    id: `new_${Date.now()}`,
    variant_id: variantId,
    price_type: availableTypes[0],
    price: 0,
    valid_from: null,
    valid_to: null,
    isNew: true,
  };

  if (!priceRules.value[variantId]) {
    priceRules.value[variantId] = [];
  }
  priceRules.value[variantId].push(newRule);
};

// 更新规则价格
const updateRulePrice = (rule, value) => {
  const price = value === '' ? 0 : Number(value);
  if (Number.isFinite(price)) {
    rule.price = price;
    rule._dirty = true;
  }
};

// 更新规则生效开始日期
const updateRuleValidFrom = (rule, value) => {
  rule.valid_from = value ? new Date(value).getTime() : null;
  rule._dirty = true;
};

// 更新规则生效结束日期
const updateRuleValidTo = (rule, value) => {
  rule.valid_to = value ? new Date(value).getTime() : null;
  rule._dirty = true;
};

// 删除规则
const deleteRule = async (rule) => {
  if (rule.isNew) {
    // 新增的规则直接移除
    const rules = priceRules.value[rule.variant_id] || [];
    const index = rules.indexOf(rule);
    if (index > -1) {
      rules.splice(index, 1);
    }
    return;
  }

  // 已存在的规则需要调用 API 删除
  try {
    const response = await fetch(`/api/manage/products/${props.productId}/prices/${rule.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (response.ok) {
      const rules = priceRules.value[rule.variant_id] || [];
      const index = rules.indexOf(rule);
      if (index > -1) {
        rules.splice(index, 1);
      }
      addToast({
        type: 'success',
        message: t('product.price_rules.delete_success', '价格规则已删除'),
      });
    }
  } catch {
    addToast({
      type: 'error',
      message: t('product.price_rules.delete_failed', '删除失败'),
    });
  }
};

// 保存所有变更
const saveChanges = async () => {
  const rulesToSave = [];

  for (const variantId of Object.keys(priceRules.value)) {
    for (const rule of priceRules.value[variantId]) {
      if (rule._dirty || rule.isNew) {
        rulesToSave.push({
          variantId: rule.variant_id,
          priceType: rule.price_type,
          price: rule.price,
          validFrom: rule.valid_from,
          validTo: rule.valid_to,
        });
      }
    }
  }

  if (rulesToSave.length === 0) return true;

  try {
    const response = await fetch(`/api/manage/products/${props.productId}/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rules: rulesToSave }),
    });

    if (response.ok) {
      // 更新本地数据
      await loadPriceRules();
      addToast({
        type: 'success',
        message: t('product.price_rules.save_success', '价格规则已保存'),
      });
      emit('update');
      return true;
    }
    return false;
  } catch {
    addToast({
      type: 'error',
      message: t('product.price_rules.save_failed', '保存失败'),
    });
    return false;
  }
};

// 格式化价格
const formatPrice = (price) => {
  return Number(price || 0).toFixed(2);
};

// 格式化日期为 input[type=date] 格式
const formatDateForInput = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
};

// 获取价格类型标签
const getPriceTypeLabel = (type) => {
  const labels = {
    retail: t('product.price_rules.type_retail', '零售价'),
    wholesale: t('product.price_rules.type_wholesale', '批发价'),
    vip: t('product.price_rules.type_vip', 'VIP 价'),
  };
  return labels[type] || formatReadableLabel(type);
};

// 获取价格类型徽章样式
const getPriceTypeBadgeClass = (type) => {
  const classes = {
    retail: 'bg-(--color-info-bg) text-(--color-info-text)',
    wholesale: 'bg-(--color-success-bg) text-(--color-success-text)',
    vip: 'bg-(--color-primary-bg) text-primary',
  };
  return classes[type] || 'bg-(--bg-muted) text-(--text-secondary)';
};

// 监听 productId 变化重新加载
watch(
  () => props.productId,
  () => {
    if (props.productId) {
      loadPriceRules();
    }
  },
  { immediate: true }
);

// 暴露 save 方法供父组件调用
defineExpose({ saveChanges });
</script>
