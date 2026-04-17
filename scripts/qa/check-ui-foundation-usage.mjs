import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rules = [
  {
    id: 'no-raw-svg-in-remediated-web-files',
    files: [
      'src/views/Dashboard.vue',
      'src/views/Stats.vue',
      'src/views/GoodsOverview.vue',
      'src/views/SpaceManager/index.vue',
      'src/views/Login.vue',
      'src/views/sales/SalesFormView.vue',
      'src/components/SpaceProductEditor.vue',
      'src/components/FileSelector.vue',
      'src/components/SalespersonPicker.vue',
      'src/components/common/AIChatWidget.vue',
      'src/components/customer/CustomerCards.vue',
      'src/components/SalespersonManager.vue',
      'src/components/SpaceCreateModal.vue',
      'src/components/salesperson/SalespersonSelectModal.vue',
      'src/components/salesperson/SalespersonCards.vue',
      'src/components/salesperson/SalespersonTable.vue',
      'src/components/salesperson/SalespersonDetailModal.vue',
      'src/components/salesperson/SalespersonForm.vue',
      'src/components/settings/tabs/AISettings.vue',
      'src/components/settings/tabs/BackupSettings.vue',
      'src/components/settings/tabs/WatermarkSettings.vue',
      'src/components/purchase-order/ProductPickerModal.vue',
      'src/components/purchase-order/OrderPickerModal.vue',
      'src/components/purchase-order/PurchaseOrderCreateDrawer.vue',
      'src/components/purchase-order/PurchaseOrderDetailDrawer.vue',
      'src/components/purchase-order/PurchaseOrderReceiptsPanel.vue',
      'src/components/purchase-order/PurchaseOrderItemsPanel.vue',
      'src/components/product/ProductCreateModal.vue',
      'src/components/product/ProductTable.vue',
      'src/components/product/ProductVariantTable.vue',
      'src/components/product/VariantBatchBuilderModal.vue',
      'src/components/space/SpaceMasonry.vue',
      'src/components/space/SpaceMediaGrid.vue',
      'src/components/space/SpaceProductDetail.vue',
      'src/components/space/SpaceSettingsTab.vue',
      'src/components/space/SpaceVisibilitySelector.vue',
      'src/components/space/SpacePassword.vue',
      'src/components/OrderStatusChanger.vue',
    ],
    patterns: [/<svg\b/g],
  },
  {
    id: 'no-raw-buttons-in-remediated-web-files',
    files: [
      'src/views/Dashboard.vue',
      'src/components/SpaceProductEditor.vue',
      'src/components/SalespersonPicker.vue',
      'src/components/common/AIChatWidget.vue',
      'src/components/common/AppErrorBoundary.vue',
      'src/components/SalespersonManager.vue',
      'src/components/SpaceCreateModal.vue',
      'src/components/SubspaceList.vue',
      'src/components/SpaceAnalytics.vue',
      'src/components/SpaceDetailModal.vue',
      'src/components/ProductManager.vue',
      'src/components/salesperson/SalespersonCards.vue',
      'src/components/salesperson/SalespersonTable.vue',
      'src/components/salesperson/SalespersonDetailModal.vue',
      'src/components/salesperson/SalespersonSelectModal.vue',
      'src/components/salesperson/SalespersonForm.vue',
      'src/components/settings/tabs/AISettings.vue',
      'src/components/settings/tabs/BackupSettings.vue',
      'src/components/settings/SettingsSidebar.vue',
      'src/components/purchase-order/ProductPickerModal.vue',
      'src/components/purchase-order/OrderPickerModal.vue',
      'src/components/purchase-order/PurchaseOrderCreateDrawer.vue',
      'src/components/purchase-order/PurchaseOrderDetailDrawer.vue',
      'src/components/purchase-order/PurchaseOrderDetailCost.vue',
      'src/components/product/ProductCreateModal.vue',
      'src/components/TagModal.vue',
      'src/components/ReloadPrompt.vue',
      'src/components/ShareManagementModal.vue',
      'src/components/common/AsyncStatePanel.vue',
      'src/components/common/PasswordGate.vue',
      'src/components/common/NotificationList.vue',
      'src/components/common/uploader/UploadPreviewItem.vue',
      'src/components/common/ai/SlotQuestionCard.vue',
      'src/components/common/ai/ActionPreviewCard.vue',
      'src/components/common/ai/AISuggestions.vue',
      'src/components/common/ai/ChatMessage.vue',
      'src/components/customer/CustomerForm.vue',
      'src/components/product/ProductBasicInfoSection.vue',
      'src/components/product/ProductDetail.vue',
      'src/components/product/ProductExportModal.vue',
      'src/components/product/ProductGrid.vue',
      'src/components/product/ProductImportModal.vue',
      'src/components/product/ProductOptionsBuilder.vue',
      'src/components/product/ProductWorkflowModal.vue',
      'src/components/product/ProductTable.vue',
      'src/components/product/ProductVariantTable.vue',
      'src/components/product/ValueArchiveModal.vue',
      'src/components/product/DimensionArchiveModal.vue',
      'src/components/product/ProductSelect.vue',
      'src/components/product/VariantImageManagerModal.vue',
      'src/components/product/import/ImportUploadStep.vue',
      'src/components/product/import/ImportMappingStep.vue',
      'src/components/product/import/ImportPreviewStep.vue',
      'src/components/product/VariantBatchBuilderModal.vue',
      'src/components/space/SpaceFilesTab.vue',
      'src/components/space/SpaceShareCard.vue',
      'src/components/space/SpaceSettingsTab.vue',
      'src/components/space/SpaceVisibilitySelector.vue',
      'src/components/space/SpaceMediaGrid.vue',
      'src/components/space/SpacePassword.vue',
      'src/components/order/OrderBatchActions.vue',
      'src/components/order/OrderFilters.vue',
      'src/components/order/SalesStats.vue',
      'src/components/order/OrderCommentInput.vue',
      'src/components/order/OrderWorkflowModal.vue',
      'src/components/order/OrderStatusHeader.vue',
      'src/components/order/OrderDetail.vue',
      'src/components/order/OrderTimeline.vue',
      'src/components/order/OrderLineCommandPanel.vue',
      'src/components/order/OrderCards.vue',
      'src/components/order/ProductBindingSection.vue',
      'src/components/order/OrderTable.vue',
      'src/components/order/SalesNotificationList.vue',
      'src/components/order/OrderLogin.vue',
      'src/components/order/OrderForm.vue',
      'src/components/OrderEditModal.vue',
      'src/components/OrderStatusChanger.vue',
      'src/components/layout/Header.vue',
      'src/components/layout/Sidebar.vue',
      'src/views/PurchaseOrders.vue',
      'src/views/FileManager/FileManagerToolbar.vue',
      'src/views/FileManager/FolderGrid.vue',
      'src/views/FileManager/TrashModal.vue',
    ],
    patterns: [/<button\b/g],
  },
  {
    id: 'no-raw-form-controls-in-remediated-web-files',
    files: [
      'src/components/salesperson/SalespersonSelectModal.vue',
      'src/components/settings/tabs/AISettings.vue',
      'src/components/settings/tabs/WatermarkSettings.vue',
      'src/components/purchase-order/ProductPickerModal.vue',
      'src/components/purchase-order/OrderPickerModal.vue',
      'src/components/purchase-order/PurchaseOrderCreateDrawer.vue',
      'src/components/product/ProductCreateModal.vue',
      'src/components/product/ProductBasicInfoSection.vue',
      'src/components/product/ProductExportModal.vue',
      'src/components/product/DimensionArchiveModal.vue',
      'src/components/product/ProductSelect.vue',
      'src/components/product/ProductOptionsBuilder.vue',
      'src/components/product/import/ImportMappingStep.vue',
      'src/components/product/import/ImportPreviewStep.vue',
      'src/components/product/ProductVariantTable.vue',
      'src/components/order/OrderCommentInput.vue',
      'src/components/order/OrderTable.vue',
      'src/components/order/ProductBindingSection.vue',
      'src/components/order/OrderLineCommandPanel.vue',
      'src/components/order/OrderReturnDialog.vue',
      'src/components/order/OrderForm.vue',
      'src/components/OrderStatusChanger.vue',
      'src/components/customer/CustomerForm.vue',
      'src/components/ShareFolderModal.vue',
      'src/components/ShareFileModal.vue',
      'src/components/space/SpaceShareCard.vue',
      'src/components/space/SpaceSettingsTab.vue',
      'src/components/space/SpacePassword.vue',
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

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '');
if (isMain) {
  process.exit(runUiFoundationUsageCheck());
}
