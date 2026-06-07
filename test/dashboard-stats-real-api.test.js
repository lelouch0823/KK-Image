import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  multipartRequest,
  uniqueSeed,
  waitFor,
} from './utils/manage-products-real-api.js';
import { createWorkflowProduct } from './utils/order-procurement-real-api.js';
import { createAuthenticatedSalesSession } from './utils/sales-real-api.js';

function sumUploadCounts(payload) {
  return (payload?.data?.uploads || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
}

describeIfRealApi('Dashboard Stats Real API', function () {
  this.timeout(180000);

  it('refreshes dashboard overview, manage stats, uploads trend, and salesperson stats after order and upload events', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('dash-stats');
    const salesSession = await createAuthenticatedSalesSession(token, seed, {
      namePrefix: 'Dashboard Stats Sales',
      store: 'Dashboard Stats Store',
    });

    const dashboardBefore = await apiRequest('/api/manage/dashboard/overview', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const baselineTodayCount = Number(dashboardBefore.json?.data?.todayCount || 0);
    const baselineWeekCount = Number(dashboardBefore.json?.data?.weekCount || 0);

    const statsBefore = await apiRequest('/api/manage/stats', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const baselineTotalFiles = Number(statsBefore.json?.data?.storage?.totalFiles || 0);
    const baselineTodayUploads = Number(statsBefore.json?.data?.storage?.todayUploads || 0);

    const uploadsBefore = await apiRequest('/api/manage/stats/uploads?days=30', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const baselineUploadTrendCount = sumUploadCounts(uploadsBefore.json);

    const salesStatsBefore = await apiRequest(`/api/sales/${salesSession.accessToken}/stats`, {
      authHeader: `Bearer ${salesSession.jwt}`,
      expectedStatus: 200,
    });
    assert.strictEqual(Number(salesStatsBefore.json?.data?.totalOrders || 0), 0);

    const { productId, variantId, productName } = await createWorkflowProduct(token, seed, {
      stockQuantity: 3,
      namePrefix: 'Dashboard Stats Product',
      skuPrefix: 'DASHSTAT',
    });

    const createdOrder = await apiRequest('/api/manage/orders', {
      bearerToken: token,
      method: 'POST',
      body: {
        productName,
        salespersonId: salesSession.salespersonId,
        productId,
        variantId,
        quantity: 1,
        fileIds: [],
      },
      expectedStatus: 201,
    });
    const orderId = createdOrder.json?.data?.id;
    assert.ok(orderId, 'dashboard stats order id missing');

    const confirmedOrder = await apiRequest(`/api/manage/orders/${orderId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const lineId = confirmedOrder.json?.data?.lines?.[0]?.id;
    assert.ok(lineId, 'dashboard stats order line missing');

    await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'confirmed' },
      expectedStatus: 200,
    });

    await apiRequest(`/api/manage/orders/${orderId}/lines/${lineId}/ship`, {
      bearerToken: token,
      method: 'POST',
      body: { quantity: 1 },
      expectedStatus: 200,
    });

    await apiRequest(`/api/manage/orders/${orderId}/status`, {
      bearerToken: token,
      method: 'PATCH',
      body: { status: 'fulfilled' },
      expectedStatus: 200,
    });

    const uploaded = await multipartRequest('/api/manage/upload', {
      bearerToken: token,
      fields: {
        file: {
          value: 'dashboard-stats-upload',
          filename: `dashboard-stats-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });
    const uploadedFileId = uploaded.json?.data?.id;
    assert.ok(uploadedFileId, 'dashboard stats uploaded file id missing');

    await waitFor(
      async () => {
        const overview = await apiRequest('/api/manage/dashboard/overview', {
          bearerToken: token,
          expectedStatus: 200,
        });
        assert.ok(Number(overview.json?.data?.todayCount || 0) >= baselineTodayCount + 1);
        assert.ok(Number(overview.json?.data?.weekCount || 0) >= baselineWeekCount + 1);
        return overview.json?.data;
      },
      {
        timeoutMs: 20000,
        intervalMs: 500,
        onTimeoutMessage: 'dashboard overview did not refresh after order/upload events',
      }
    );

    await waitFor(
      async () => {
        const stats = await apiRequest('/api/manage/stats', {
          bearerToken: token,
          expectedStatus: 200,
        });
        assert.ok(Number(stats.json?.data?.storage?.totalFiles || 0) >= baselineTotalFiles + 1);
        assert.ok(Number(stats.json?.data?.storage?.todayUploads || 0) >= baselineTodayUploads + 1);
        return stats.json?.data;
      },
      {
        timeoutMs: 20000,
        intervalMs: 500,
        onTimeoutMessage: 'manage stats projection did not refresh after upload event',
      }
    );

    await waitFor(
      async () => {
        const uploads = await apiRequest('/api/manage/stats/uploads?days=30', {
          bearerToken: token,
          expectedStatus: 200,
        });
        assert.ok(sumUploadCounts(uploads.json) >= baselineUploadTrendCount + 1);
        return uploads.json?.data;
      },
      {
        timeoutMs: 10000,
        intervalMs: 500,
        onTimeoutMessage: 'manage uploads trend did not reflect latest upload',
      }
    );

    await waitFor(
      async () => {
        const salesStats = await apiRequest(`/api/sales/${salesSession.accessToken}/stats`, {
          authHeader: `Bearer ${salesSession.jwt}`,
          expectedStatus: 200,
        });
        assert.strictEqual(Number(salesStats.json?.data?.totalOrders || 0), 1);
        assert.strictEqual(Number(salesStats.json?.data?.completedOrders || 0), 1);
        assert.strictEqual(Number(salesStats.json?.data?.monthOrders || 0), 1);
        assert.strictEqual(salesStats.json?.data?.monthlyTrend?.length, 30);
        return salesStats.json?.data;
      },
      {
        timeoutMs: 20000,
        intervalMs: 500,
        onTimeoutMessage: 'salesperson stats did not refresh after order events',
      }
    );
  });
});
