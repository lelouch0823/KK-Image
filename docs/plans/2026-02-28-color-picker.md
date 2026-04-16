# Color Picker for Product Dimensions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a State-of-the-Art (SOTA) color picking experience for "Color" product dimensions. Users should be able to specify a hex color when adding a color, and modify existing colors interactively. Hex codes are saved to the SQLite DB and consumed by the UI.

**Architecture:** We will add a `meta` JSON column to the `product_dimension_values` table. The frontend uses a reactive `metaMap` to track colors. We upgrade the API sync logic to allow updating the `meta` of existing values (Upsert). The Vue UI detects "Color" dimensions, shows a picker during creation, and embeds hidden `<input type="color">` fields inside existing value tags for seamless editing.

**Tech Stack:** Cloudflare D1 (SQLite), Cloudflare Workers (Hono), Vue 3, Tailwind CSS v4.

---

### Task 1: Database Migration for `meta` column

**Files:**
- Create: `migrations/0047_product_dimension_meta.sql`

**Step 1: Write migration SQL**

```sql
-- Migration: 0047_product_dimension_meta.sql
-- Description: Add meta column to product_dimension_values for extending dimension attributes like color hex codes.

ALTER TABLE product_dimension_values ADD COLUMN meta TEXT;
```

**Step 2: Apply migration to local D1 (Optional local verification)**
Run: `pnpm run db:migrate:local` (if applicable, otherwise assume applied during tests automatically)

**Step 3: Commit**

```bash
git add migrations/0047_product_dimension_meta.sql
git commit -m "feat(db): add meta column to product_dimension_values"
```

---

### Task 2: Backend Repository Update (`ProductDimensionRepository.js`)

**Files:**
- Modify: `functions/repositories/ProductDimensionRepository.js`

**Step 1: Write/Modify Repository Logic**

Update `addValue` to handle `meta`:
```javascript
// At the top of file
const formatMeta = (meta) => {
    if (!meta) return null;
    return typeof meta === 'string' ? meta : JSON.stringify(meta);
};

// Inside addValue:
        let metaStr = formatMeta(payload.meta);

        await this.db
            .prepare(`INSERT INTO product_dimension_values (id, dimension_id, value, status, sort_order, meta, created_at, updated_at)
                VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`)
            .bind(id, dimensionId, value, sortOrder, metaStr, timestamp, timestamp)
            .run();
```

Add [SOTA] `updateValueMeta`:
```javascript
    async updateValueMeta(productId, dimensionId, valueId, meta) {
        // verify ownership
        const valueRow = await this.db.prepare(`
            SELECT v.id FROM product_dimension_values v
            JOIN product_dimensions d ON d.id = v.dimension_id
            WHERE v.id = ? AND d.product_id = ? AND d.id = ?
        `).bind(valueId, productId, dimensionId).first();
        
        if (!valueRow) throw new Error('dimension value not found for product');

        const timestamp = now();
        const metaStr = formatMeta(meta);
        
        await this.db
            .prepare('UPDATE product_dimension_values SET meta = ?, updated_at = ? WHERE id = ?')
            .bind(metaStr, timestamp, valueId)
            .run();
    }
```

**Step 2: Commit**

```bash
git add functions/repositories/ProductDimensionRepository.js
git commit -m "feat(api): add repository support for dimension value meta and updates"
```

---

### Task 3: Backend API Sync Logic (`[id].js`)

**Files:**
- Modify: `functions/lib/hono/routes/manage/products/[id].js`

**Step 1: Update `syncDimensionsFromPayload` to Upsert `meta`**

Modify `syncDimensionsFromPayload`:
```javascript
        const current = existingById.get(dimension.id) || { values: [] };
        const existingValuesMap = new Map((current.values || []).map((item) => [item.value, item]));
        const incomingVals = (incoming.values || []).map(v => typeof v === 'string' ? { value: v } : v).filter(v => v.value);

        for (const item of incomingVals) {
            const valStr = String(item.value).trim();
            if (!valStr) continue;
            
            if (!existingValuesMap.has(valStr)) {
                await dimensionRepo.addValue(productId, dimension.id, { value: valStr, meta: item.meta });
                existingValuesMap.set(valStr, { value: valStr, meta: typeof item.meta === 'string' ? item.meta : JSON.stringify(item.meta) });
            } else {
                // SOTA logic: update meta if different
                const existingRec = existingValuesMap.get(valStr);
                const newMetaStr = item.meta ? (typeof item.meta === 'string' ? item.meta : JSON.stringify(item.meta)) : null;
                const oldMetaStr = existingRec.meta || null;
                
                if (newMetaStr !== oldMetaStr) {
                    await dimensionRepo.updateValueMeta(productId, dimension.id, existingRec.id, item.meta);
                    existingRec.meta = newMetaStr;
                }
            }
        }
```

**Step 2: Commit**

```bash
git add functions/lib/hono/routes/manage/products/[id].js
git commit -m "feat(api): synchronize and update dimension value meta during product save"
```

---

### Task 4: Frontend state management for options `meta` (`useProductForm.js`)

**Files:**
- Modify: `src/composables/useProductForm.js`

**Step 1: Modify `toOptionModel`, `addOptionValue`, and `handleSubmit`**

In `toOptionModel()`:
```javascript
function toOptionModel(raw = {}) {
  const values = [];
  const metaMap = {};

  if (Array.isArray(raw.values)) {
    raw.values.forEach(entry => {
       const val = typeof entry === 'string' ? entry : entry?.value;
       const cleanVal = String(val || '').trim();
       if (cleanVal && entry?.status !== 'archived') {
          values.push(cleanVal);
          if (entry?.meta) {
              const metaObj = typeof entry.meta === 'string' ? parseJson(entry.meta) : entry.meta;
              if (metaObj) metaMap[cleanVal] = metaObj;
          }
       }
    });
  }

  return {
    id: raw.id || null,
    name: String(raw.name || '').trim(),
    values: [...new Set(values)],
    metaMap, // Reactive mapping of value -> meta object
    inputValue: '',
    archivedValues: Array.isArray(raw.values)
      ? raw.values.filter(entry => entry && typeof entry === 'object' && entry.status === 'archived')
      : [],
  };
}
```

In `addOptionValue()`:
```javascript
  const addOptionValue = async (opt, extraMeta = null) => {
    if (!opt.inputValue) return;
    const vals = opt.inputValue.split(',').map((v) => v.trim()).filter(Boolean);
    if (!opt.metaMap) opt.metaMap = {};

    for (const v of vals) {
      if (!opt.values.includes(v)) opt.values.push(v);
      if (extraMeta) opt.metaMap[v] = { ...opt.metaMap[v], ...extraMeta };

      if (editMode.value && opt.id && initialData.value?.id) {
        const payload = { value: v };
        if (opt.metaMap[v]) payload.meta = opt.metaMap[v];
        
        const response = await addDimensionValue(initialData.value.id, opt.id, payload);
        if (!response?.success) {
          addToast({ message: response?.error || t('common.operationFailed'), type: 'error' });
        }
      }
    }
    opt.inputValue = '';
    generateVariants();
  };
```

In `handleSubmit()`:
```javascript
        dimensions: form.options
          .filter((option) => option.name)
          .map((option) => ({
            id: option.id || undefined,
            name: option.name,
            values: option.values.map(val => ({
                 value: val,
                 meta: option.metaMap?.[val] || undefined
            })),
          })),
```

**Step 2: Commit**

```bash
git add src/composables/useProductForm.js
git commit -m "feat(ui): manage dimension value meta state in product form"
```

---

### Task 5: UI integration in `ProductOptionsBuilder.vue` (SOTA Interface)

**Files:**
- Modify: `src/components/product/ProductOptionsBuilder.vue`

**Step 1: Write SOTA UI implementation**

Add to script:
```javascript
const isColorDimension = (name) => {
    if (!name) return false;
    const lower = name.toLowerCase();
    return lower.includes('color') || lower.includes('颜色') || lower.includes('色');
};
const pendingColorSelection = ref('#000000');
```

Replace input value section and tag group section in template:
```html
        <!-- 值输入 + tag chips -->
        <div>
          <div class="flex items-center gap-2">
            <!-- Text Input -->
            <AppInput
              v-model="opt.inputValue"
              :placeholder="isColorDimension(opt.name) ? t('product.form.option_color', 'Enter color name e.g., Red') : t('product.form.option_values', 'Enter values separated by comma')"
              size="sm"
              class="flex-1"
              @keydown.enter.prevent="isColorDimension(opt.name) ? $emit('add-value', opt, { color: pendingColorSelection }) : $emit('add-value', opt)"
            />
            
            <!-- Default Color Picker Picker -->
            <div v-if="isColorDimension(opt.name)" class="relative size-8 shrink-0 overflow-hidden rounded-md border border-(--border-color)">
                <input 
                    type="color" 
                    v-model="pendingColorSelection"
                    title="Select color for new value"
                    class="absolute -inset-2 size-12 cursor-pointer bg-transparent"
                />
            </div>
            
            <AppButton
              v-if="opt.inputValue"
              variant="secondary"
              text="Add"
              size="sm"
              @click="isColorDimension(opt.name) ? $emit('add-value', opt, { color: pendingColorSelection }) : $emit('add-value', opt)"
            />
          </div>

          <!-- 活跃值 tags -->
          <div class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="(val, vIdx) in opt.values"
              :key="vIdx"
              class="inline-flex items-center gap-1.5 rounded-full border border-(--border-color) bg-(--bg-muted) px-2.5 py-1 text-xs font-medium text-(--text-main) transition-colors hover:bg-(--bg-page)"
            >
              <!-- SOTA Interactive Color Swatch -->
              <label 
                v-if="opt.metaMap && opt.metaMap[val] && opt.metaMap[val].color" 
                class="relative size-3.5 cursor-pointer rounded-full shadow-inner ring-1 ring-inset ring-black/10 transition-transform hover:scale-110"
                :style="{ backgroundColor: opt.metaMap[val].color }"
                title="Click to edit color"
              >
                  <input 
                      type="color" 
                      v-model="opt.metaMap[val].color" 
                      class="absolute opacity-0 size-0" 
                  />
              </label>
              
              {{ val }}
              
              <button
                type="button"
                class="ml-1 cursor-pointer text-(--text-muted) transition-colors hover:text-danger"
                @click="$emit('remove-value', opt, vIdx)"
              >
                &times;
              </button>
            </span>
          </div>
```

**Step 2: Check Visuals**
Run frontend. Ensure clicking an existing color swatch brings up picker and properly updates `.color`.

**Step 3: Commit**

```bash
git add src/components/product/ProductOptionsBuilder.vue
git commit -m "feat(ui): add SOTA interactive color picking for product options"
```

---

### Task 6: Consume meta.color in `ProductBindingSection.vue`

**Files:**
- Modify: `src/components/order/ProductBindingSection.vue`

**Step 1: Bind UI to dynamic colors**

Update `buildColorSwatchStyle`:
```javascript
const buildColorSwatchStyle = (value) => {
  if (!value) return {};
  
  // Highest priority: Product meta color configuration
  const colorDimension = (props.boundProduct?.dimensions || []).find(d => 
       typeof d.name === 'string' && (d.name.toLowerCase().includes('color') || d.name.includes('色'))
  );
  
  if (colorDimension) {
      const valObj = (colorDimension.values || []).find(v => v.value === value);
      if (valObj && valObj.meta) {
          const metaObj = typeof valObj.meta === 'string' ? JSON.parse(valObj.meta) : valObj.meta;
          if (metaObj?.color) {
              return { backgroundColor: metaObj.color };
          }
      }
  }

  // Fallback to static dictionary
  const lower = String(value).toLowerCase();
  const hex = COLOR_VALUE_MAP[lower] || COLOR_VALUE_MAP[value] || '#e5e7eb';
  return { backgroundColor: hex };
};
```

**Step 2: Commit**

```bash
git add src/components/order/ProductBindingSection.vue
git commit -m "feat(ui): render dynamic dimension colors in product binding section"
```
