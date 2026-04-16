import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('frontend design token contracts', () => {
  it('keeps shared admin shells on semantic surfaces instead of raw gray, white, amber, and overlay utilities', () => {
    const checks = [
      {
        file: 'src/components/layout/Header.vue',
        forbidden: ['border-white', 'border-amber-300', 'bg-amber-50', 'text-amber-700'],
      },
      {
        file: 'src/components/layout/Sidebar.vue',
        forbidden: ['bg-black/50', 'from-gray-800', 'to-black', 'text-white'],
      },
      {
        file: 'src/components/common/NotificationList.vue',
        forbidden: [
          'text-gray-400',
          'text-gray-200',
          'hover:!bg-black/5',
          'dark:hover:!bg-white/10',
        ],
      },
      {
        file: 'src/components/common/ai/ActionResultCard.vue',
        forbidden: ['#bbf7d0', '#f0fdf4'],
      },
    ];

    checks.forEach(({ file, forbidden }) => {
      const source = readSource(file);
      forbidden.forEach((token) => {
        expect(source, `${file} should not contain ${token}`).not.toContain(token);
      });
    });
  });

  it('keeps business panels on tone tokens instead of raw slate, amber, and dark gray utilities', () => {
    const checks = [
      {
        file: 'src/components/SpaceProductEditor.vue',
        forbidden: [
          'bg-white',
          'dark:bg-gray-900',
          'dark:text-gray-400',
          'dark:hover:text-gray-200',
          'border-blue-500/20',
          'bg-blue-50/50',
          'text-blue-800',
          'border-amber-500/25',
          'bg-amber-50/80',
          'text-amber-900',
        ],
      },
      {
        file: 'src/components/outbox/OutboxReplayPanel.vue',
        forbidden: ['border-slate-800', 'bg-slate-950', 'text-slate-100'],
      },
      {
        file: 'src/components/order/OrderLineCommandPanel.vue',
        forbidden: [
          'border-amber-500/20',
          'bg-amber-500/8',
          'text-amber-700',
          'border-sky-500/20',
          'bg-sky-500/8',
          'text-sky-700',
          'border-emerald-500/20',
          'bg-emerald-500/8',
          'text-emerald-700',
          'bg-slate-500/10',
          'bg-orange-500/10',
          'text-orange-600',
          'text-sky-600',
        ],
      },
    ];

    checks.forEach(({ file, forbidden }) => {
      const source = readSource(file);
      forbidden.forEach((token) => {
        expect(source, `${file} should not contain ${token}`).not.toContain(token);
      });
    });
  });

  it('removes remaining dark-mode white fallbacks and raw overlay utilities from auxiliary admin surfaces', () => {
    const checks = [
      {
        file: 'src/views/FileManager/index.vue',
        forbidden: ['dark:bg-white/10'],
      },
      {
        file: 'src/views/sales/SalesSpacesView.vue',
        forbidden: ['bg-black/50', 'text-white'],
      },
      {
        file: 'src/components/product/import/ImportPreviewStep.vue',
        forbidden: [
          'dark:border-white/10',
          'dark:bg-white/5',
          'dark:text-white',
          'dark:bg-white/10',
          'dark:text-green-300',
          'dark:text-red-300',
        ],
      },
      {
        file: 'src/components/product/import/ImportMappingStep.vue',
        forbidden: ['dark:border-white/10', 'dark:text-white'],
      },
      {
        file: 'src/components/order/SalesNotificationList.vue',
        forbidden: ['hover:bg-black/5', 'dark:hover:bg-white/10'],
      },
      {
        file: 'src/components/order/OrderLogin.vue',
        forbidden: ['hover:bg-black/5'],
      },
      {
        file: 'src/components/order/OrderStatusHeader.vue',
        forbidden: [
          'border-emerald-500/15',
          'bg-emerald-500/6',
          'text-emerald-700',
          'border-emerald-600/20',
          'bg-emerald-600/10',
        ],
      },
      {
        file: 'src/components/order/OrderReturnDialog.vue',
        forbidden: ['border-emerald-500/15', 'bg-emerald-500/6', 'text-emerald-700'],
      },
      {
        file: 'src/components/common/uploader/UploadPreviewItem.vue',
        forbidden: [
          'bg-black/40',
          'bg-white/90',
          'hover:bg-white',
          'dark:bg-black/50',
          'dark:hover:bg-black/70',
          'bg-black/50',
          'text-white',
          '<svg',
        ],
      },
      {
        file: 'src/components/product/VariantImageManagerModal.vue',
        forbidden: ['bg-black/40', 'bg-white', 'text-white'],
      },
    ];

    checks.forEach(({ file, forbidden }) => {
      const source = readSource(file);
      forbidden.forEach((token) => {
        expect(source, `${file} should not contain ${token}`).not.toContain(token);
      });
    });
  });

  it('uses semantic inverse and overlay tokens on preview surfaces and shared UI primitives', () => {
    const checks = [
      {
        file: 'src/components/space/SpaceMasonry.vue',
        forbidden: [
          'from-black/60',
          'text-white',
          'bg-black/95',
          'bg-white/10',
          'hover:!bg-white/20',
          'hover:!text-white',
        ],
      },
      {
        file: 'src/components/space/SpaceProductDetail.vue',
        forbidden: [
          'bg-black/50',
          'text-white',
          'hover:!bg-black/70',
          'hover:!text-white',
          'bg-white',
          'bg-white/50',
        ],
      },
      {
        file: 'src/views/Gallery.vue',
        forbidden: ['from-black/60', 'text-white'],
      },
      {
        file: 'src/components/space/SpaceMediaGrid.vue',
        forbidden: ['text-white'],
      },
      {
        file: 'src/components/space/SpaceVisibilitySelector.vue',
        forbidden: ['text-white'],
      },
      {
        file: 'src/views/Sales.vue',
        forbidden: ['text-white'],
      },
      {
        file: 'src/components/salesperson/SalespersonSelectModal.vue',
        forbidden: ['bg-white', 'text-white'],
      },
      {
        file: 'src/components/ui/AppCheckbox.vue',
        forbidden: ['dark:border-white/20', 'dark:bg-white/5', 'dark:focus:ring-offset-gray-900'],
      },
      {
        file: 'src/components/ui/PermissionDeniedState.vue',
        forbidden: ['text-white', 'hover:text-white'],
      },
      {
        file: 'src/components/ui/Modal.vue',
        forbidden: ['.bg-white.rounded-xl.shadow-2xl'],
      },
      {
        file: 'src/components/OrderStatusChanger.vue',
        forbidden: ['bg-gray-400'],
      },
      {
        file: 'src/components/order/OrderReturnHistoryCard.vue',
        forbidden: ['text-emerald-600'],
      },
    ];

    checks.forEach(({ file, forbidden }) => {
      const source = readSource(file);
      forbidden.forEach((token) => {
        expect(source, `${file} should not contain ${token}`).not.toContain(token);
      });
    });
  });

  it('keeps reusable overlay widgets and inverse controls on semantic inverse tokens', () => {
    const checks = [
      {
        file: 'src/components/ui/Lightbox.vue',
        forbidden: [
          'bg-black/95',
          'from-black/50',
          'text-white',
          'border-white/10',
          'bg-white/10',
          'hover:bg-white/20',
          'focus-visible:ring-white',
        ],
      },
      {
        file: 'src/components/common/AIChatWidget.vue',
        forbidden: ['bg-white/20', 'text-white', 'hover:!bg-white/10', 'dark:[&_input]:bg-white/5'],
      },
      {
        file: 'src/views/GoodsOverview.vue',
        forbidden: ['text-white'],
      },
      {
        file: 'src/components/common/ai/ChatMessage.vue',
        forbidden: ['border-white/30'],
      },
      {
        file: 'src/components/ui/AppButton.vue',
        forbidden: ['text-white'],
      },
    ];

    checks.forEach(({ file, forbidden }) => {
      const source = readSource(file);
      forbidden.forEach((token) => {
        expect(source, `${file} should not contain ${token}`).not.toContain(token);
      });
    });
  });

  it('uses border tokens instead of raw black rings on shared floating surfaces', () => {
    const checks = [
      {
        file: 'src/components/product/ProductSelect.vue',
        forbidden: ['ring-black/5'],
      },
      {
        file: 'src/components/product/ProductOptionsBuilder.vue',
        forbidden: ['ring-black/10'],
      },
      {
        file: 'src/components/ui/ContextMenu.vue',
        forbidden: ['ring-black/5'],
      },
      {
        file: 'src/components/ui/StatusSelector.vue',
        forbidden: ['ring-black/5'],
      },
      {
        file: 'src/components/ui/Modal.vue',
        forbidden: ['ring-black/5'],
      },
      {
        file: 'src/components/purchase-order/PurchaseOrderListTable.vue',
        forbidden: ['ring-black/5'],
      },
    ];

    checks.forEach(({ file, forbidden }) => {
      const source = readSource(file);
      forbidden.forEach((token) => {
        expect(source, `${file} should not contain ${token}`).not.toContain(token);
      });
    });
  });

  it('removes the last raw semantic color utilities from file-management, messaging, and detail helpers', () => {
    const checks = [
      {
        file: 'src/views/FileManager/TrashModal.vue',
        forbidden: ['from-green-100', 'to-blue-50'],
      },
      {
        file: 'src/views/FileManager/FileManagerToolbar.vue',
        forbidden: ['hover:border-red-200', 'hover:bg-red-50'],
      },
      {
        file: 'src/components/MoveItemModal.vue',
        forbidden: ['text-yellow-400'],
      },
      {
        file: 'src/components/salesperson/SalespersonCards.vue',
        forbidden: ['shadow-black/5'],
      },
      {
        file: 'src/components/space/SpaceProductDetail.vue',
        forbidden: ['text-red-500'],
      },
      {
        file: 'src/components/SubspaceList.vue',
        forbidden: ['hover:bg-red-100'],
      },
      {
        file: 'src/components/ReloadPrompt.vue',
        forbidden: ['text-green-500'],
      },
      {
        file: 'src/components/order/OrderProcurementBadge.vue',
        forbidden: ['text-purple-500', 'bg-purple-500'],
      },
      {
        file: 'src/components/common/ai/ChatMessage.vue',
        forbidden: ['to-purple'],
      },
      {
        file: 'src/components/common/uploader/UploadButton.vue',
        forbidden: ['<svg'],
      },
      {
        file: 'src/utils/highlight.js',
        forbidden: ['bg-yellow-200', 'text-yellow-900'],
      },
      {
        file: 'src/views/sales/SalesSpacesView.vue',
        forbidden: ['<svg'],
      },
      {
        file: 'src/components/SubspaceList.vue',
        forbidden: ['<svg'],
      },
      {
        file: 'src/components/purchase-order/PurchaseOrderDetailSummary.vue',
        forbidden: ['backgroundColor:', ':style="{', 'color: statusConfig['],
      },
      {
        file: 'src/composables/usePurchaseOrderListPresentation.js',
        forbidden: ["'purple'"],
      },
      {
        file: 'src/composables/usePurchaseOrders.js',
        forbidden: ['--color-purple', '--color-purple-bg'],
      },
    ];

    checks.forEach(({ file, forbidden }) => {
      const source = readSource(file);
      forbidden.forEach((token) => {
        expect(source, `${file} should not contain ${token}`).not.toContain(token);
      });
    });
  });
});
