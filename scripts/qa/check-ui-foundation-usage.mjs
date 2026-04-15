import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const rules = [
  {
    id: 'no-raw-svg-in-remediated-web-files',
    files: [
      'src/views/Dashboard.vue',
      'src/views/Stats.vue',
      'src/views/GoodsOverview.vue',
      'src/views/SpaceManager/index.vue',
      'src/views/Login.vue',
      'src/components/SpaceProductEditor.vue',
      'src/components/FileSelector.vue',
      'src/components/common/AIChatWidget.vue',
      'src/components/salesperson/SalespersonSelectModal.vue',
      'src/components/settings/tabs/AISettings.vue',
      'src/components/purchase-order/ProductPickerModal.vue',
      'src/components/purchase-order/OrderPickerModal.vue',
      'src/components/purchase-order/PurchaseOrderCreateDrawer.vue',
      'src/components/purchase-order/PurchaseOrderDetailDrawer.vue',
      'src/components/product/ProductCreateModal.vue',
      'src/components/product/ProductTable.vue',
      'src/components/product/ProductVariantTable.vue',
      'src/components/product/VariantBatchBuilderModal.vue',
      'src/components/space/SpaceMasonry.vue',
      'src/components/space/SpaceProductDetail.vue',
      'src/components/OrderStatusChanger.vue',
    ],
    patterns: [/<svg\b/g],
  },
  {
    id: 'no-raw-buttons-in-remediated-web-files',
    files: [
      'src/components/SpaceProductEditor.vue',
      'src/components/common/AIChatWidget.vue',
      'src/components/salesperson/SalespersonSelectModal.vue',
      'src/components/settings/tabs/AISettings.vue',
      'src/components/purchase-order/ProductPickerModal.vue',
      'src/components/purchase-order/OrderPickerModal.vue',
      'src/components/purchase-order/PurchaseOrderCreateDrawer.vue',
      'src/components/purchase-order/PurchaseOrderDetailDrawer.vue',
      'src/components/product/ProductCreateModal.vue',
      'src/components/product/ProductTable.vue',
      'src/components/product/ProductVariantTable.vue',
      'src/components/product/VariantBatchBuilderModal.vue',
      'src/components/order/OrderForm.vue',
      'src/components/OrderStatusChanger.vue',
    ],
    patterns: [/<button\b/g],
  },
  {
    id: 'no-raw-form-controls-in-remediated-web-files',
    files: [
      'src/components/salesperson/SalespersonSelectModal.vue',
      'src/components/settings/tabs/AISettings.vue',
      'src/components/purchase-order/ProductPickerModal.vue',
      'src/components/purchase-order/OrderPickerModal.vue',
      'src/components/purchase-order/PurchaseOrderCreateDrawer.vue',
      'src/components/product/ProductCreateModal.vue',
      'src/components/product/ProductVariantTable.vue',
      'src/components/order/OrderForm.vue',
      'src/components/OrderStatusChanger.vue',
    ],
    patterns: [/<input\b/g, /<textarea\b/g, /<select\b/g],
  },
];

const scanRule = (rootDir, rule) => {
  const violations = [];
  for (const relativeFile of rule.files) {
    const absoluteFile = path.resolve(rootDir, relativeFile);
    if (!existsSync(absoluteFile)) {
      continue;
    }

    const source = readFileSync(absoluteFile, 'utf8');
    for (const pattern of rule.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match = regex.exec(source);
      while (match) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        violations.push({
          ruleId: rule.id,
          file: relativeFile,
          line,
          match: match[0],
        });
        match = regex.exec(source);
      }
    }
  }
  return violations;
};

export const runUiFoundationUsageCheck = (rootDir = process.cwd()) => {
  const violations = rules.flatMap((rule) => scanRule(rootDir, rule));

  if (violations.length > 0) {
    console.error('UI foundation usage check failed:');
    for (const violation of violations) {
      console.error(
        `- [${violation.ruleId}] ${violation.file}:${violation.line} contains ${violation.match}`
      );
    }
    return 1;
  }

  console.log('UI foundation usage check passed.');
  return 0;
};

process.exit(runUiFoundationUsageCheck());
