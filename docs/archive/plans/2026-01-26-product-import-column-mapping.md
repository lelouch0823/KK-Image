# Product Import Column Mapping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to map columns from their uploaded Excel/CSV files to the system's product fields (Name, SKU, Price, etc.) before importing.

**Architecture:** 
1.  **Frontend (Vue)**: Update `ProductImportModal.vue` to introduce a multi-step wizard flow:
    *   Step 1: Download Template (existing).
    *   Step 2: Upload File (existing, but now pauses for mapping).
    *   Step 3: Column Mapping (NEW) - Users select which header from their file corresponds to system fields.
    *   Step 4: Preview & Confirm (existing).
    *   Step 5: Result (existing).
2.  **Logic**: After file parsing, extracting headers. Present a mapping UI. Transform the data based on the user's mapping before sending to the backend.

**Tech Stack:** Vue 3, Tailwind CSS, XLSX (SheetJS).

---

### Task 1: Update ProductImportModal Structure and Logic

**Files:**
- Modify: `src/components/product/ProductImportModal.vue`

**Step 1: Define System Fields and State**

Define the schema for system fields we need to map to.

```javascript
// System fields definition
const SYSTEM_FIELDS = [
    { key: 'name', label: '商品名称', required: true },
    { key: 'sku', label: 'SKU (编码)', required: true },
    { key: 'price', label: '价格', required: false }, // Default 0
    { key: 'stock_quantity', label: '库存', required: false }, // Default 0
    { key: 'description', label: '描述', required: false },
    { key: 'image_url', label: '图片链接', required: false },
    { key: 'category', label: '分类', required: false },
    { key: 'brand', label: '品牌', required: false }
];

// New State
const currentStep = ref(1); // 1: Template, 2: Upload, 3: Mapping, 4: Preview/Result
const fileHeaders = ref([]); // extracted from Excel row 0
const fieldMapping = ref({}); // { system_key: user_header_string }
```

**Step 2: Implement Header Extraction**

Modify `processFile` to extracting headers instead of immediately normalizing.

```javascript
/* In processFile */
// ... read workbook ...
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Header: 1 returns array of arrays
if (jsonData.length === 0) { throw new Error('Empty file'); }

const headers = jsonData[0]; // First row
fileHeaders.value = headers;

// Auto-match logic (Best effort)
const newMapping = {};
SYSTEM_FIELDS.forEach(field => {
    // Try to find a header that includes the field key or label (case insensitive)
    const match = headers.find(h => 
        String(h).toLowerCase().includes(field.key) || 
        String(h).includes(field.label)
    );
    if (match) newMapping[field.key] = match;
});
fieldMapping.value = newMapping;

// Store raw data for later processing (minus header)
rawFileRows.value = jsonData.slice(1); 

// Move to mapping step
currentStep.value = 3; 
```

**Step 3: Implement Mapping UI (Step 3)**

Add the mapping interface to the template.

```html
<!-- Step 3: Column Mapping -->
<div v-if="currentStep === 3">
    <h3 class="font-medium text-lg mb-4">列名映射</h3>
    <div class="grid grid-cols-1 gap-4 max-h-[50vh] overflow-y-auto">
        <div v-for="field in SYSTEM_FIELDS" :key="field.key" class="flex items-center justify-between border-b pb-2">
            <div class="flex flex-col">
                <span class="font-medium text-sm">
                    {{ field.label }} 
                    <span v-if="field.required" class="text-red-500">*</span>
                </span>
                <span class="text-xs text-gray-500">System Field: {{ field.key }}</span>
            </div>
            <div class="w-1/2">
                <Select
                    v-model="fieldMapping[field.key]"
                    :options="[{label: '忽略 (Ignore)', value: ''}, ...fileHeaders.map(h => ({label: h, value: h}))]"
                    placeholder="选择对应列"
                />
            </div>
        </div>
    </div>
</div>
```

**Step 4: Implement Data Transformation (Step 4 Preview)**

After user confirms mapping, transform the data.

```javascript
const handleConfirmMapping = () => {
    // Validate required fields
    if (!fieldMapping.value['name'] || !fieldMapping.value['sku']) {
        addToast({ type: 'error', message: '请至少映射“名称”和“SKU”字段' });
        return;
    }

    // Transform
    const mappedData = rawFileRows.value.map(row => {
        // row is an array if header:1 was used? 
        // Wait, if we use sheet_to_json with header:1, rows are arrays.
        // If we use sheet_to_json without header, rows are objects keyed by header.
        // Better to use sheet_to_json(worksheet) (objects) for easier access IF headers are unique.
        // BUT if user wants custom mapping, headers might be duplicated or messy.
        // Robustness: Use header:1 (array of arrays).
        
        // Let's assume header 1 logic:
        // row is [val1, val2, ...]
        // fieldMapping['name'] = 'HeaderName' -> we need index of 'HeaderName'
        
        const item = {};
        SYSTEM_FIELDS.forEach(field => {
            const headerName = fieldMapping.value[field.key];
            if (headerName) {
                const colIndex = fileHeaders.value.indexOf(headerName);
                if (colIndex !== -1) {
                    item[field.key] = row[colIndex];
                }
            }
        });
        
        // Defaults
        item.status = 'active'; 
        return item;
    }).filter(i => i.name && i.sku);

    parsedItems.value = mappedData;
    currentStep.value = 4; // Preview
};
```

**Step 5: Verify & Commit**

- Test with a file that has "Product Name" instead of "name".
- Verify UI prompts for mapping.
- Verify imported data has the correct values.

### Task 2: Backend Full Export API

**Files:**
- Create: `functions/lib/hono/routes/manage/products/export.js`
- Modify: `functions/lib/hono/routes/manage/products/index.js` (mount it)

**Step 1: Implement Steaming Export Endpoint**
- **Endpoint**: `GET /api/manage/products/export?format=csv`
- **Logic**:
    - Query D1 for *all* products (cursor/pagination loop to avoid memory limits).
    - Use `TransformStream` to convert objects to CSV lines on the fly.
    - Return a `Response` with `Content-Type: text/csv` and the readable stream.
    - **SOTA**: Avoid loading 10k rows into memory. Stream row by row.

**Step 2: Frontend Integration**
- Update `handleExport` in `ProductManager.vue` to `window.open('/api/manage/products/export?format=csv')` instead of client-side generation, or offer both ("Export Current Page" vs "Export All").

### Task 3: Advanced Image Import UX (Image Matching)

**Goal**: Solve the "how to import images from Excel" problem.

**UX Design (The "Smart Match" Approach)**:
1.  **Step 1 Template**: User fills Excel. Column `Image` contains filenames (e.g., `1001.jpg`, `front.png`) instead of URLs.
2.  **Step 2 Text Import**: User uploads Excel. System parses it.
3.  **Step 3 Mapping**: User maps a column to `image_url` (or `image_filename`).
4.  **Step 4 Image Upload (New)**: 
    - UI shows: "Detected 50 image references. Please upload these files."
    - User drags a folder or multiple files into a dropzone.
    - Frontend **Smart Matches** uploaded files to the Excel rows by Name (Fuzzy or Exact).
    - Visual feedback: "Matched 48/50 images".
5.  **Step 5 Submit**:
    - Frontend uploads the matched images to `POST /api/upload` (sequentially or batched).
    - Replaces the filename in the payload with the returned *Remote R2 URL*.
    - Submits the final product JSON to `batch` API.

**Implementation**:
- Update `ProductImportModal` to add "Image Upload" step if the mapped "Image" column contains non-URL strings.
- Implementation of the Client-side matching logic.

#### UI/UX Design Specs (via ui-ux-pro-max)

**Goal**: Professional, "Premium" feel for batch operations. Avoid generic administrative look.

1.  **Dropzone Component**:
    -   **Visual**: `rounded-xl`, `border-2`, `border-dashed`, `border-slate-300` (Light) / `border-slate-700` (Dark).
    -   **Interaction**: `hover:border-primary` `hover:bg-primary/5` `transition-all duration-200 cursor-pointer`.
    -   **Iconography**: Use **Heroicons** (e.g., `PhotoIcon`, `CloudArrowUpIcon`). **No Emojis**. Size `w-12 h-12`.
    -   **Typography**:
        -   Headline: `text-slate-900` (Dark: `text-white`) font-medium.
        -   Subtext: `text-slate-500` (Dark: `text-slate-400`) text-sm.

2.  **Matching Feedback (The "Wowed" Factor)**:
    -   **Presentation**: Use a **masonry or grid** layout for matched images to show volume.
    -   **Micro-interactions**:
        -   When a file matches an Excel row: Show a green "link" animation or pulse.
        -   **Success State**: `bg-green-50` border `border-green-200` with `text-green-700` badge.
        -   **Missing State**: `bg-amber-50` border `border-amber-200` with `text-amber-700` badge.
    -   **Stats**: Large, clear numbers. "48/50 Matched".

3.  **Upload Progress**:
    -   **Visual**: Slim progress bar with "shimmer" effect (`animate-pulse` or custom gradient animation).
    -   **Placement**: Sticky bottom action bar.

4.  **Accessibility & Theme**:
    -   **Dark Mode**: Ensure modal background is `bg-slate-900` (not pure black) or `bg-slate-800` for cards.
    -   **Contrast**: Text must satisfy WCAG 4.5:1. Use `slate-400` for muted text, not `gray-300`.
    -   **Focus**: Visible focus rings for keyboard navigation.




