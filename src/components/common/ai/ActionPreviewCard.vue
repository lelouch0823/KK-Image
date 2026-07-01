<template>
  <div class="border-primary/20 bg-primary/5 rounded-2xl border p-4 shadow-card">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="bg-primary/12 text-primary rounded-full px-2.5 py-1 text-xs font-medium"
            >Step 2 · {{ t('ai.actionPreview.step2', '确认预览') }}</span
          >
          <span
            class="rounded-full bg-(--bg-card) px-2.5 py-1 text-xs font-medium text-(--text-secondary)"
            >{{ entityLabel }}</span
          >
        </div>
        <p class="mt-3 text-sm font-semibold text-(--text-main)">{{ titleText }}</p>
        <p class="mt-1 text-sm text-(--text-secondary)">{{ t('ai.actionPreview.confirmHint', '请确认以下信息后再创建。') }}</p>
      </div>
      <AppButton size="sm" class="shrink-0 !rounded-xl" :text="t('ai.actionPreview.confirmCreate', '确认创建')" @click="$emit('confirm')" />
    </div>

    <div class="mt-4 space-y-4">
      <section
        v-for="section in sections"
        :key="section.title"
        class="rounded-2xl bg-(--bg-card) p-3 shadow-sm"
      >
        <p class="text-xs font-semibold tracking-[0.08em] text-(--text-secondary) uppercase">
          {{ section.title }}
        </p>

        <div v-if="section.layout === 'grid'" class="mt-3 grid gap-2 sm:grid-cols-2">
          <div
            v-for="row in section.rows"
            :key="row.label"
            class="rounded-xl bg-(--bg-muted) px-3 py-2"
          >
            <p class="text-xs text-(--text-secondary)">{{ row.label }}</p>
            <p class="mt-1 text-sm font-medium text-(--text-main)">{{ row.value }}</p>
          </div>
        </div>

        <div v-else class="mt-3 space-y-2">
          <div
            v-for="row in section.rows"
            :key="row.key || row.label"
            class="rounded-xl bg-(--bg-muted) px-3 py-2"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-(--text-secondary)">{{ row.label }}</p>
                <p class="mt-1 text-sm leading-6 font-medium text-(--text-main)">{{ row.value }}</p>
              </div>
              <div v-if="row.meta" class="shrink-0 text-right">
                <p class="text-xs text-(--text-secondary)">{{ t('ai.actionPreview.unitPrice', '单价') }}</p>
                <p class="mt-1 text-sm font-medium text-(--text-main)">{{ row.meta }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import { formatSummaryValue } from '@/utils/event-display';

const { t } = useI18n();

defineEmits(['confirm']);

const props = defineProps({
  action: {
    type: Object,
    default: () => ({}),
  },
});

const titleText = computed(() => props.action?.title || t('ai.actionPreview.createPreview', '创建预览'));
const entityType = computed(() => String(props.action?.entityType || '').trim());
const summary = computed(() => props.action?.summary || {});
const ENTITY_LABELS = {
  order: t('ai.actionPreview.entity.order', '订单'),
  purchase_order: t('ai.actionPreview.entity.purchaseOrder', '采购单'),
  product: t('ai.actionPreview.entity.product', '商品'),
  customer: t('ai.actionPreview.entity.customer', '客户'),
  salesperson: t('ai.actionPreview.entity.salesperson', '销售员'),
};
const entityLabel = computed(() => ENTITY_LABELS[entityType.value] || t('ai.actionPreview.entity.record', '记录'));

function toText(value) {
  return formatSummaryValue(value);
}

function buildGridSection(title, entries) {
  const rows = entries
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => ({ label, value: toText(value) }));
  return rows.length > 0 ? { title, layout: 'grid', rows } : null;
}

function resolvePurchaseItemLabel(item) {
  return toText(item.variant_query || item.product_name || item.variant_name || t('ai.actionPreview.selectedProduct', '已选择商品'));
}

function buildItemsSection(items = []) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return {
    title: t('ai.actionPreview.purchaseDetails', '采购明细'),
    layout: 'list',
    rows: items
      .map((item, index) => ({
        key: `${item.product_id || item.variant_id || item.variant_query || 'item'}-${index}`,
        label: t('ai.actionPreview.detailN', '明细 {n}', { n: index + 1 }),
        value: resolvePurchaseItemLabel(item),
        meta:
          item.unit_cost !== undefined && item.unit_cost !== null ? toText(item.unit_cost) : null,
      }))
      .map((row, index) => ({
        ...row,
        value: `${row.value}${items[index]?.quantity ? ` · ${t('ai.actionPreview.quantity', '数量')} ${items[index].quantity}` : ''}`,
      })),
  };
}

const sections = computed(() => {
  if (entityType.value === 'order') {
    return [
      buildGridSection(t('ai.actionPreview.coreInfo', '核心信息'), [
        [t('ai.actionPreview.product', '商品'), summary.value.productName],
        [t('ai.actionPreview.salesperson', '销售员'), summary.value.salespersonId],
      ]),
      buildGridSection(t('ai.actionPreview.specAndQty', '规格与数量'), [
        [t('ai.actionPreview.quantity', '数量'), summary.value.quantity],
        [t('ai.actionPreview.color', '颜色'), summary.value.color],
        [t('ai.actionPreview.size', '尺码'), summary.value.size],
        [t('ai.actionPreview.material', '材质'), summary.value.material],
      ]),
      buildGridSection(t('ai.actionPreview.supplementary', '补充说明'), [
        [t('ai.actionPreview.remark', '备注'), summary.value.remark],
        [t('ai.actionPreview.deadline', '交期'), summary.value.deadline],
        [t('ai.actionPreview.status', '状态'), summary.value.status],
      ]),
    ].filter(Boolean);
  }

  if (entityType.value === 'purchase_order') {
    return [
      buildGridSection(t('ai.actionPreview.createMethod', '创建方式'), [
        [t('ai.actionPreview.mode', '模式'), summary.value.mode],
        [t('ai.actionPreview.remark', '备注'), summary.value.remark],
        [t('ai.actionPreview.currency', '币种'), summary.value.currency],
      ]),
      buildItemsSection(summary.value.items),
      buildGridSection(t('ai.actionPreview.feeInfo', '费用信息'), [
        [t('ai.actionPreview.allocationMethod', '分摊方式'), summary.value.allocation_method],
        [t('ai.actionPreview.estimatedShipping', '预计运费'), summary.value.estimated_shipping_cost],
        [t('ai.actionPreview.estimatedTariff', '预计关税'), summary.value.estimated_tariff_cost],
      ]),
    ].filter(Boolean);
  }

  if (entityType.value === 'product') {
    return [
      buildGridSection(t('ai.actionPreview.basicInfo', '基础信息'), [
        [t('ai.actionPreview.productName', '商品名称'), summary.value.name],
        ['SPU', summary.value.spu],
        [t('ai.actionPreview.brand', '品牌'), summary.value.brand],
        [t('ai.actionPreview.category', '分类'), summary.value.category],
        [t('ai.actionPreview.currency', '币种'), summary.value.currency],
      ]),
      buildGridSection(t('ai.actionPreview.specStructure', '规格结构'), [
        [
          t('ai.actionPreview.specDimensions', '规格维度'),
          Array.isArray(summary.value.dimensions)
            ? t('ai.actionPreview.nDimensions', '{n} 个维度', { n: summary.value.dimensions.length })
            : t('ai.actionPreview.nDimensions', '{n} 个维度', { n: 0 }),
        ],
        [t('ai.actionPreview.variantCount', '变体数量'), Array.isArray(summary.value.variants) ? summary.value.variants.length : 0],
      ]),
      Array.isArray(summary.value.variants) && summary.value.variants.length > 0
        ? {
            title: t('ai.actionPreview.variantSamples', '变体样本'),
            layout: 'list',
            rows: summary.value.variants.slice(0, 3).map((variant, index) => ({
              key: `variant-${index}`,
              label: t('ai.actionPreview.variantN', '变体 {n}', { n: index + 1 }),
              value:
                Object.entries(variant.options_values || {})
                  .map(([, item]) => item)
                  .filter(Boolean)
                  .join(' / ') || t('ai.actionPreview.unnamedVariant', '未命名变体'),
              meta: variant.price !== undefined ? toText(variant.price) : null,
            })),
          }
        : null,
    ].filter(Boolean);
  }

  return [
    buildGridSection(
      t('ai.actionPreview.previewInfo', '预览信息'),
      Object.entries(summary.value).map(([key, value]) => [key, value])
    ),
  ].filter(Boolean);
});
</script>
