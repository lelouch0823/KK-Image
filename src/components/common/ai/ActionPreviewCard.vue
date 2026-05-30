<template>
  <div class="border-primary/20 bg-primary/5 rounded-2xl border p-4 shadow-card">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="bg-primary/12 text-primary rounded-full px-2.5 py-1 text-[11px] font-medium">Step 2 · 确认预览</span>
          <span class="rounded-full bg-(--bg-card) px-2.5 py-1 text-[11px] font-medium text-(--text-secondary)">{{ entityLabel }}</span>
        </div>
        <p class="mt-3 text-sm font-semibold text-(--text-main)">{{ titleText }}</p>
        <p class="mt-1 text-sm text-(--text-secondary)">请确认以下信息后再创建。</p>
      </div>
      <AppButton
        size="sm"
        class="shrink-0 !rounded-xl"
        text="确认创建"
        @click="$emit('confirm')"
      />
    </div>

    <div class="mt-4 space-y-4">
      <section
        v-for="section in sections"
        :key="section.title"
        class="rounded-2xl bg-(--bg-card) p-3 shadow-sm"
      >
        <p class="text-xs font-semibold tracking-[0.08em] text-(--text-secondary) uppercase">{{ section.title }}</p>

        <div v-if="section.layout === 'grid'" class="mt-3 grid gap-2 sm:grid-cols-2">
          <div
            v-for="row in section.rows"
            :key="row.label"
            class="rounded-xl bg-(--bg-muted) px-3 py-2"
          >
            <p class="text-[11px] text-(--text-secondary)">{{ row.label }}</p>
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
                <p class="text-[11px] text-(--text-secondary)">{{ row.label }}</p>
                <p class="mt-1 text-sm leading-6 font-medium text-(--text-main)">{{ row.value }}</p>
              </div>
              <div v-if="row.meta" class="shrink-0 text-right">
                <p class="text-[11px] text-(--text-secondary)">单价</p>
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
import AppButton from '@/components/ui/AppButton.vue';

defineEmits(['confirm']);

const props = defineProps({
  action: {
    type: Object,
    default: () => ({}),
  },
});

const titleText = computed(() => props.action?.title || '创建预览');
const entityType = computed(() => String(props.action?.entityType || '').trim());
const summary = computed(() => props.action?.summary || {});
const ENTITY_LABELS = {
  order: '订单',
  purchase_order: '采购单',
  product: '商品',
  customer: '客户',
  salesperson: '销售员',
};
const entityLabel = computed(() => ENTITY_LABELS[entityType.value] || '记录');

function toText(value) {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function buildGridSection(title, entries) {
  const rows = entries
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => ({ label, value: toText(value) }));
  return rows.length > 0 ? { title, layout: 'grid', rows } : null;
}

function buildItemsSection(items = []) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return {
    title: '采购明细',
    layout: 'list',
    rows: items.map((item, index) => ({
      key: `${item.product_id || item.variant_id || item.variant_query || 'item'}-${index}`,
      label: `明细 ${index + 1}`,
      value: toText(item.variant_query || item.product_name || item.product_id || '-'),
      meta: item.unit_cost !== undefined && item.unit_cost !== null ? toText(item.unit_cost) : null,
    })).map((row, index) => ({
      ...row,
      value: `${row.value}${items[index]?.quantity ? ` · 数量 ${items[index].quantity}` : ''}`,
    })),
  };
}

const sections = computed(() => {
  if (entityType.value === 'order') {
    return [
      buildGridSection('核心信息', [
        ['商品', summary.value.productName],
        ['销售员', summary.value.salespersonId],
      ]),
      buildGridSection('规格与数量', [
        ['数量', summary.value.quantity],
        ['颜色', summary.value.color],
        ['尺码', summary.value.size],
        ['材质', summary.value.material],
      ]),
      buildGridSection('补充说明', [
        ['备注', summary.value.remark],
        ['交期', summary.value.deadline],
        ['状态', summary.value.status],
      ]),
    ].filter(Boolean);
  }

  if (entityType.value === 'purchase_order') {
    return [
      buildGridSection('创建方式', [
        ['模式', summary.value.mode],
        ['备注', summary.value.remark],
        ['币种', summary.value.currency],
      ]),
      buildItemsSection(summary.value.items),
      buildGridSection('费用信息', [
        ['分摊方式', summary.value.allocation_method],
        ['预计运费', summary.value.estimated_shipping_cost],
        ['预计关税', summary.value.estimated_tariff_cost],
      ]),
    ].filter(Boolean);
  }

  if (entityType.value === 'product') {
    return [
      buildGridSection('基础信息', [
        ['商品名称', summary.value.name],
        ['SPU', summary.value.spu],
        ['品牌', summary.value.brand],
        ['分类', summary.value.category],
        ['币种', summary.value.currency],
      ]),
      buildGridSection('规格结构', [
        ['规格维度', Array.isArray(summary.value.dimensions) ? `${summary.value.dimensions.length} 个维度` : '0 个维度'],
        ['变体数量', Array.isArray(summary.value.variants) ? summary.value.variants.length : 0],
      ]),
      Array.isArray(summary.value.variants) && summary.value.variants.length > 0
        ? {
            title: '变体样本',
            layout: 'list',
            rows: summary.value.variants.slice(0, 3).map((variant, index) => ({
              key: `variant-${index}`,
              label: `变体 ${index + 1}`,
              value: Object.entries(variant.options_values || {}).map(([, item]) => item).filter(Boolean).join(' / ') || '未命名变体',
              meta: variant.price !== undefined ? toText(variant.price) : null,
            })),
          }
        : null,
    ].filter(Boolean);
  }

  return [
    buildGridSection('预览信息', Object.entries(summary.value).map(([key, value]) => [key, value])),
  ].filter(Boolean);
});
</script>
