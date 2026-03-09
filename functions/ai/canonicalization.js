const TERM_GROUPS = [
  { canonical: 'variant', aliases: ['商品规格', '款式规格', '规格', '变体'] },
  { canonical: 'salesperson', aliases: ['业务员', '销售员', '导购'] },
  { canonical: 'purchase_order', aliases: ['备货单', '补货单', '采购单'] },
];

const CREATE_PREFIXES = ['创建', '新建', '新增', '添加', '帮我建', '帮我新增', '帮我创建'];
const ENTITY_CREATE_MAP = [
  { entityType: 'salesperson', actionType: 'create_salesperson', aliases: ['业务员', '销售员', '导购', '销售账号'] },
  { entityType: 'customer', actionType: 'create_customer', aliases: ['客户', '客户档案', '联系人'] },
  { entityType: 'order', actionType: 'create_order', aliases: ['订单', '预订单', '建单'] },
  { entityType: 'product', actionType: 'create_product', aliases: ['商品', '产品', '新款', '款式'] },
  { entityType: 'purchase_order', actionType: 'create_purchase_order', aliases: ['采购单', '备货单', '补货单'] },
];

function includesAny(text, candidates = []) {
  return candidates.some((candidate) => text.includes(candidate));
}

export function canonicalizeBusinessText(text = '') {
  const source = String(text || '').trim();
  const matches = [];

  for (const group of TERM_GROUPS) {
    const alias = [...group.aliases]
      .sort((a, b) => b.length - a.length)
      .find((candidate) => source.includes(candidate));

    if (alias) {
      matches.push({
        canonical: group.canonical,
        alias,
      });
    }
  }

  return {
    text: source,
    normalizedTerms: [...new Set(matches.map((item) => item.canonical))],
    matches,
  };
}

export function detectCreateIntent(text = '') {
  const source = String(text || '').trim();
  if (!includesAny(source, CREATE_PREFIXES)) return null;

  const found = ENTITY_CREATE_MAP.find((item) => includesAny(source, item.aliases));
  if (!found) return null;

  return {
    entityType: found.entityType,
    actionType: found.actionType,
    text: source,
  };
}
