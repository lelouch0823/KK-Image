import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('OrderManager design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/OrderManager.vue'), 'utf8');
    expect(source).toContain('ManagementListShell');
  });

  it('keeps the page title in the shell instead of the filter bar', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/order/OrderFilters.vue'), 'utf8');
    expect(source).toContain('<AppFilterBar');
    expect(source).not.toContain('<AppFilterBar :title=');
    expect(source).not.toContain('<AppFilterBar :subtitle=');
  });

  it('keeps order action surfaces on shared buttons and inputs', () => {
    const batchActions = readFileSync(
      resolve(process.cwd(), 'src/components/order/OrderBatchActions.vue'),
      'utf8'
    );
    const filters = readFileSync(resolve(process.cwd(), 'src/components/order/OrderFilters.vue'), 'utf8');
    const salesStats = readFileSync(resolve(process.cwd(), 'src/components/order/SalesStats.vue'), 'utf8');
    const commentInput = readFileSync(
      resolve(process.cwd(), 'src/components/order/OrderCommentInput.vue'),
      'utf8'
    );

    expect(batchActions).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(batchActions).not.toContain('<button');

    expect(filters).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(filters).not.toContain('<button');

    expect(salesStats).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(salesStats).not.toContain('<button');

    expect(commentInput).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(commentInput).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(commentInput).not.toContain('<button');
    expect(commentInput).not.toContain('<input');
  });

  it('keeps order detail workflow actions on shared primitives', () => {
    const workflowModal = readFileSync(
      resolve(process.cwd(), 'src/components/order/OrderWorkflowModal.vue'),
      'utf8'
    );
    const statusHeader = readFileSync(
      resolve(process.cwd(), 'src/components/order/OrderStatusHeader.vue'),
      'utf8'
    );
    const orderDetail = readFileSync(
      resolve(process.cwd(), 'src/components/order/OrderDetail.vue'),
      'utf8'
    );
    const timeline = readFileSync(resolve(process.cwd(), 'src/components/order/OrderTimeline.vue'), 'utf8');
    const lineCommandPanel = readFileSync(
      resolve(process.cwd(), 'src/components/order/OrderLineCommandPanel.vue'),
      'utf8'
    );

    expect(workflowModal).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(workflowModal).not.toContain('<button');

    expect(statusHeader).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(statusHeader).not.toContain('<button');

    expect(orderDetail).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(orderDetail).not.toContain('<button');

    expect(timeline).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(timeline).not.toContain('<button');

    expect(lineCommandPanel).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(lineCommandPanel).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(lineCommandPanel).not.toContain('<button');
    expect(lineCommandPanel).not.toContain('<input');
  });

  it('keeps remaining order UI surfaces on shared buttons and selects', () => {
    const orderCards = readFileSync(resolve(process.cwd(), 'src/components/order/OrderCards.vue'), 'utf8');
    const orderTable = readFileSync(resolve(process.cwd(), 'src/components/order/OrderTable.vue'), 'utf8');
    const notifications = readFileSync(
      resolve(process.cwd(), 'src/components/order/SalesNotificationList.vue'),
      'utf8'
    );
    const orderLogin = readFileSync(resolve(process.cwd(), 'src/components/order/OrderLogin.vue'), 'utf8');
    const orderReturnDialog = readFileSync(
      resolve(process.cwd(), 'src/components/order/OrderReturnDialog.vue'),
      'utf8'
    );

    expect(orderCards).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(orderCards).not.toContain('<button');

    expect(orderTable).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(orderTable).not.toContain('<button');

    expect(notifications).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(notifications).not.toContain('<button');

    expect(orderLogin).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(orderLogin).not.toContain('<button');

    expect(orderReturnDialog).toContain("import Select from '@/components/ui/Select.vue'");
    expect(orderReturnDialog).not.toContain('<select');
  });
});
