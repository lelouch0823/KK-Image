function firstMatch(text, patterns = []) {
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[1]) return String(match[1]).trim();
  }
  return '';
}

function firstNumber(text, patterns = []) {
  const value = firstMatch(text, patterns);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPhone(text = '') {
  const match = String(text).match(/1\d{10}/);
  return match?.[0] || '';
}

function extractEmail(text = '') {
  const match = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || '';
}

function splitValues(value = '') {
  return String(value)
    .split(/[|/、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function expandNumericRange(start, end) {
  const a = Number.parseInt(String(start || '').trim(), 10);
  const b = Number.parseInt(String(end || '').trim(), 10);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a || b - a > 20) return [];
  return Array.from({ length: b - a + 1 }, (_, index) => String(a + index));
}

function parseFreeColorValues(text = '') {
  const compactPair = String(text).match(
    /([黑白红蓝绿黄灰紫粉棕银金橙米卡藏青深蓝浅蓝]{2,6})(?:两个颜色|两个色|两种颜色|两色)/
  );
  if (compactPair?.[1]) {
    const chars = compactPair[1].split('').filter(Boolean);
    const normalizedCompact = chars.map((item) => (item.endsWith('色') ? item : `${item}色`));
    return [...new Set(normalizedCompact)];
  }

  const explicitColorBlock = firstMatch(text, [
    /(?:颜色|顏色)\s*[:：]?\s*([^\n，,。]+)/,
    /([黑白红蓝绿黄灰紫粉棕银金橙米卡藏青深蓝浅蓝]+(?:色)?(?:\s*[、/\s|]\s*[黑白红蓝绿黄灰紫粉棕银金橙米卡藏青深蓝浅蓝]+(?:色)?)+)/,
  ]);
  if (!explicitColorBlock) return [];

  const rawParts = explicitColorBlock
    .replace(/两个颜色|两个色|两种颜色|两色/g, '')
    .split(/[、/\s|,，]/)
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  const normalized = rawParts.map((item) => (item.endsWith('色') ? item : `${item}色`));
  return [...new Set(normalized)];
}

function parseFreeSizeValues(text = '') {
  const rangeMatch = String(text).match(/(\d{2,3})\s*(?:到|-|至)\s*(\d{2,3})\s*码/);
  if (rangeMatch) {
    return expandNumericRange(rangeMatch[1], rangeMatch[2]);
  }

  const block = firstMatch(text, [
    /(?:尺码|尺碼|码数|碼數)\s*[:：]?\s*([0-9/\s|、，,-]{2,40})/,
    /((?:\d{2,3}\s*[/、，|]\s*)+\d{2,3})/,
  ]);
  if (!block) return [];
  return [...new Set(splitValues(block))];
}

function cartesianDimensions(dimensions = []) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) return [{}];
  return dimensions.reduce(
    (acc, dimension) => {
      const values = Array.isArray(dimension.values) ? dimension.values : [];
      const next = [];
      for (const row of acc) {
        for (const value of values) {
          next.push({ ...row, [dimension.name]: value });
        }
      }
      return next;
    },
    [{}]
  );
}

function extractCustomerSlots(text = '') {
  const slots = {};
  const name = firstMatch(text, [
    /(?:客户|联系人)\s*([A-Za-z][A-Za-z\s-]{1,40}|[\u4e00-\u9fa5]{2,12})/,
    /(?:姓名|名字|名称)\s*[:：]?\s*([A-Za-z][A-Za-z\s-]{1,40}|[\u4e00-\u9fa5]{2,12})/,
  ]);
  if (name) slots.name = name;

  const phone = extractPhone(text);
  if (phone) slots.phone = phone;

  const email = extractEmail(text);
  if (email) slots.email = email;

  const company = firstMatch(text, [/(?:公司)\s*[:：]?\s*([^\s，,。]+)/]);
  if (company) slots.company = company;

  const address = firstMatch(text, [/(?:地址)\s*[:：]?\s*([^\n。]+)/]);
  if (address) slots.address = address;

  return slots;
}

function extractSalespersonSlots(text = '') {
  const slots = {};
  const name = firstMatch(text, [
    /(?:业务员|销售员|导购)\s*([A-Za-z][A-Za-z\s-]{1,40}|[\u4e00-\u9fa5]{2,12})/,
    /(?:姓名|名字|名称)\s*[:：]?\s*([A-Za-z][A-Za-z\s-]{1,40}|[\u4e00-\u9fa5]{2,12})/,
  ]);
  if (name) slots.name = name;

  const store = firstMatch(text, [
    /门店\s*[:：]?\s*([^\n，,。]+)/,
    /店铺\s*[:：]?\s*([^\n，,。]+)/,
  ]);
  if (store) slots.store = store;

  const phone = extractPhone(text);
  if (phone) slots.phone = phone;

  const password = firstMatch(text, [/密码\s*[:：=]?\s*([^\s，,。]+)/]);
  if (password) slots.password = password;

  return slots;
}

function extractOrderSlots(text = '') {
  const slots = {};
  const productName = firstMatch(text, [
    /(?:商品名|产品名|名称)\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9\s._/-]{1,80}|[\u4e00-\u9fa5A-Za-z0-9\s._/-]{2,80})/,
  ]);
  if (productName) slots.productName = productName;

  const salesperson = firstMatch(text, [
    /给\s*([A-Za-z][A-Za-z\s-]{1,40}|[\u4e00-\u9fa5]{2,12}?)(?=\s*(?:下|建|创建|订单|，|,|。|$))/,
    /(?:销售员|业务员)\s*[:：]?\s*([A-Za-z][A-Za-z\s-]{1,40}|[\u4e00-\u9fa5]{2,12})/,
  ]);
  if (salesperson) slots.salespersonId = salesperson;

  const quantity = firstNumber(text, [/数量\s*[:：=]?\s*(\d+)/, /(\d+)\s*(?:件|个|双|套|箱)/]);
  if (quantity) slots.quantity = quantity;

  const color = firstMatch(text, [
    /([黑白红蓝绿黄灰紫粉棕银金橙米卡藏青深蓝浅蓝]+色)/,
    /颜色\s*[:：]?\s*([^\s，,。]+)/,
  ]);
  if (color) slots.color = color;

  const size = firstMatch(text, [/(\d+(?:\.\d+)?)\s*码/, /尺码\s*[:：]?\s*([A-Za-z0-9.]+)/]);
  if (size) slots.size = size;

  return slots;
}

function extractPurchaseOrderSlots(text = '') {
  const slots = {};
  if (/(?:从订单|根据订单|按订单)/.test(text)) {
    slots.mode = 'from_orders';
  } else if (/(?:采购单|备货单|补货单)/.test(text)) {
    slots.mode = 'manual';
  }

  const orderIds = Array.from(
    new Set((String(text).match(/\bord-[a-z0-9-]+\b/gi) || []).map((item) => item.trim()))
  );
  if (orderIds.length > 0) slots.order_ids = orderIds;

  const remark = firstMatch(text, [/备注\s*[:：]?\s*([^\n，,。]+)/]);
  if (remark) slots.remark = remark;

  const currency = firstMatch(text, [/\b(CNY|USD|EUR|GBP|JPY)\b/i, /(人民币|美元|欧元|英镑|日元)/]);
  if (currency) {
    const currencyMap = { 人民币: 'CNY', 美元: 'USD', 欧元: 'EUR', 英镑: 'GBP', 日元: 'JPY' };
    slots.currency = currencyMap[currency] || currency.toUpperCase();
  }

  if (slots.mode !== 'from_orders') {
    const bodyText = String(text).split(/备注\s*[:：]?/)[0];
    const normalizedBody = bodyText.replace(/^(创建(?:采购单|备货单|补货单)[，,\s]*)/, '').trim();
    const segments = normalizedBody
      .split(/[;；]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const items = [];

    for (const segment of segments) {
      const quantity = firstNumber(segment, [
        /补货\s*(\d+)\s*(?:件|个|双|套|箱)/,
        /数量\s*[:：=]?\s*(\d+)/,
        /(\d+)\s*(?:件|个|双|套|箱)/,
      ]);
      const unitCost = firstNumber(segment, [/单价\s*[:：=]?\s*(\d+)/, /成本\s*[:：=]?\s*(\d+)/]);
      const variantQuery = firstMatch(segment, [
        /^([A-Za-z0-9\u4e00-\u9fa5\s._/-]{2,60}?)(?=\s*(?:补货|采购|单价|成本|$))/,
      ]);

      if (variantQuery || quantity !== null || unitCost !== null) {
        items.push({
          variant_query: String(variantQuery || '').trim(),
          quantity: quantity ?? 1,
          unit_cost: unitCost ?? undefined,
        });
      }
    }

    if (items.length > 0) {
      slots.mode = 'manual';
      slots.items = items;
    }
  }

  return slots;
}

function extractProductSlots(text = '') {
  const slots = {};
  const name = firstMatch(text, [
    /(?:商品名|产品名|名称)\s*[:：]?\s*([A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\s._/-]{1,80}?)(?=\s+(?:SPU|币种|规格|售价|价格|成本|库存|预警)\b|[，,。]|$)/,
    /(?:创建商品|新建商品|新增商品|创建产品|新建产品)\s+([A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\s._/-]{1,40}?)(?=[，,。]|$|\s+(?:黑白|颜色|尺码|尺碼|售价|价格|成本|库存|预警))/,
  ]);
  if (name) slots.name = name;

  const spu = firstMatch(text, [/\bSPU\s*[:：]?\s*([A-Za-z0-9_-]+)/i]);
  if (spu) slots.spu = spu;

  const currency = firstMatch(text, [/\b(CNY|USD|EUR|GBP|JPY)\b/i, /(人民币|美元|欧元|英镑|日元)/]);
  if (currency) {
    const currencyMap = { 人民币: 'CNY', 美元: 'USD', 欧元: 'EUR', 英镑: 'GBP', 日元: 'JPY' };
    slots.currency = currencyMap[currency] || currency.toUpperCase();
  }

  const specBlock = firstMatch(text, [
    /规格\s*[:：]?\s*([^\n]+?)(?=(?:售价|价格|成本|库存|预警|$))/,
  ]);
  const dimensions = [];
  if (specBlock) {
    const segments = specBlock
      .split(/[;；]/)
      .map((item) => item.trim())
      .filter(Boolean);
    for (const segment of segments) {
      const [rawName, rawValues] = segment.split('=').map((item) => String(item || '').trim());
      if (!rawName || !rawValues) continue;
      const values = splitValues(rawValues);
      if (values.length === 0) continue;
      dimensions.push({ name: rawName, values });
    }
  }
  if (dimensions.length > 0) {
    slots.dimensions = dimensions;
  }

  if (dimensions.length === 0) {
    const freeColors = parseFreeColorValues(text);
    const freeSizes = parseFreeSizeValues(text);
    const freeDimensions = [];
    if (freeColors.length > 0) {
      freeDimensions.push({ name: '颜色', values: freeColors });
    }
    if (freeSizes.length > 0) {
      freeDimensions.push({ name: '尺码', values: freeSizes });
    }
    if (freeDimensions.length > 0) {
      slots.dimensions = freeDimensions;
    }
  }

  const price = firstNumber(text, [/售价\s*[:：=]?\s*(\d+)/, /价格\s*[:：=]?\s*(\d+)/]);
  const costPrice = firstNumber(text, [/成本\s*[:：=]?\s*(\d+)/]);
  const stock = firstNumber(text, [/库存\s*[:：=]?\s*(\d+)/]);
  const alert = firstNumber(text, [/预警\s*[:：=]?\s*(\d+)/]);

  const activeDimensions = Array.isArray(slots.dimensions) ? slots.dimensions : dimensions;
  if (activeDimensions.length > 0 && price !== null && costPrice !== null && stock !== null) {
    slots.variants = cartesianDimensions(activeDimensions).map((optionsValues) => ({
      options_values: optionsValues,
      price,
      cost_price: costPrice,
      stock_quantity: stock,
      alert_threshold: alert ?? 10,
      status: 'active',
    }));
  }

  return slots;
}

export function extractActionSlots(entityType, text = '') {
  const source = String(text || '').trim();
  if (!source) return {};

  switch (String(entityType || '').trim()) {
    case 'customer':
      return extractCustomerSlots(source);
    case 'salesperson':
      return extractSalespersonSlots(source);
    case 'order':
      return extractOrderSlots(source);
    case 'purchase_order':
      return extractPurchaseOrderSlots(source);
    case 'product':
      return extractProductSlots(source);
    default:
      return {};
  }
}
