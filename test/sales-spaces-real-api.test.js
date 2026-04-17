import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
  waitFor,
} from './utils/manage-products-real-api.js';
import {
  createAuthenticatedSalesSession,
  createSalespersonFixture,
  salesApiRequest,
} from './utils/sales-real-api.js';

function findSpaceByName(payload, name) {
  return (payload?.data || []).find((item) => item.name === name) || null;
}

function parseTemplateData(space) {
  const raw = space?.template_data;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

describeIfRealApi('Sales Spaces Real API', function () {
  this.timeout(180000);

  it('shows only assigned top-level spaces and only visible non-expired subspaces in detail', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('sales-spaces');
    const salesSession = await createAuthenticatedSalesSession(token, `${seed}-primary`, {
      namePrefix: 'Sales Space Primary',
      store: 'Sales Space Store',
    });
    const secondarySales = await createSalespersonFixture(token, `${seed}-secondary`, {
      namePrefix: 'Sales Space Secondary',
      store: 'Sales Space Store',
    });

    await apiRequest('/api/manage/spaces', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Visible All ${seed}`,
        description: 'visible to all salespersons',
        template: 'gallery',
        shareMode: 'all',
      },
      expectedStatus: 201,
    });

    const selectedParent = await apiRequest('/api/manage/spaces', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Visible Selected ${seed}`,
        description: 'visible to selected salesperson',
        template: 'collection',
        shareMode: 'selected',
        sharedSalespersonIds: [salesSession.salespersonId],
      },
      expectedStatus: 201,
    });
    const selectedParentId = selectedParent.json?.data?.id;
    assert.ok(selectedParentId, 'selected parent space id missing');

    await apiRequest('/api/manage/spaces', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Hidden Selected ${seed}`,
        description: 'visible only to other salesperson',
        template: 'gallery',
        shareMode: 'selected',
        sharedSalespersonIds: [secondarySales.salespersonId],
      },
      expectedStatus: 201,
    });

    await apiRequest('/api/manage/spaces', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Hidden None ${seed}`,
        description: 'share mode none',
        template: 'gallery',
        shareMode: 'none',
      },
      expectedStatus: 201,
    });

    await apiRequest('/api/manage/spaces', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Expired Top ${seed}`,
        description: 'expired all space',
        template: 'gallery',
        shareMode: 'all',
        expiresAt: Date.now() - 60_000,
      },
      expectedStatus: 201,
    });

    await apiRequest(`/api/manage/spaces/${selectedParentId}/subspaces`, {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Visible Child All ${seed}`,
        description: 'subspace visible to all',
        template: 'gallery',
        shareMode: 'all',
      },
      expectedStatus: 201,
    });

    await apiRequest(`/api/manage/spaces/${selectedParentId}/subspaces`, {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Visible Child Selected ${seed}`,
        description: 'subspace visible to selected salesperson',
        template: 'gallery',
        shareMode: 'selected',
        sharedSalespersonIds: [salesSession.salespersonId],
      },
      expectedStatus: 201,
    });

    await apiRequest(`/api/manage/spaces/${selectedParentId}/subspaces`, {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Hidden Child Selected ${seed}`,
        description: 'subspace visible to other salesperson',
        template: 'gallery',
        shareMode: 'selected',
        sharedSalespersonIds: [secondarySales.salespersonId],
      },
      expectedStatus: 201,
    });

    await apiRequest(`/api/manage/spaces/${selectedParentId}/subspaces`, {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Expired Child ${seed}`,
        description: 'expired child subspace',
        template: 'gallery',
        shareMode: 'all',
        expiresAt: Date.now() - 60_000,
      },
      expectedStatus: 201,
    });

    const list = await salesApiRequest(
      salesSession.accessToken,
      salesSession.jwt,
      `/api/sales/${salesSession.accessToken}/spaces`,
      { expectedStatus: 200 }
    );
    const listed = list.json?.data || [];

    assert.ok(findSpaceByName(list.json, `Visible All ${seed}`), 'all-shared top-level space missing');
    assert.ok(findSpaceByName(list.json, `Visible Selected ${seed}`), 'selected visible top-level space missing');
    assert.ok(!findSpaceByName(list.json, `Hidden Selected ${seed}`), 'other-selected top-level space leaked');
    assert.ok(!findSpaceByName(list.json, `Hidden None ${seed}`), 'share-mode-none top-level space leaked');
    assert.ok(!findSpaceByName(list.json, `Expired Top ${seed}`), 'expired top-level space leaked');
    assert.strictEqual(
      listed.some((item) => item.parent_id),
      false,
      'sales top-level list should not include child spaces'
    );

    const selectedVisibleSpace = findSpaceByName(list.json, `Visible Selected ${seed}`);
    assert.ok(selectedVisibleSpace?.id, 'selected visible space id missing in sales list');

    const detail = await salesApiRequest(
      salesSession.accessToken,
      salesSession.jwt,
      `/api/sales/${salesSession.accessToken}/spaces/${selectedVisibleSpace.id}`,
      { expectedStatus: 200 }
    );
    const subspaces = detail.json?.data?.subspaces || [];

    assert.ok(
      subspaces.some((item) => item.name === `Visible Child All ${seed}`),
      'all-shared child subspace missing from sales detail'
    );
    assert.ok(
      subspaces.some((item) => item.name === `Visible Child Selected ${seed}`),
      'selected visible child subspace missing from sales detail'
    );
    assert.ok(
      !subspaces.some((item) => item.name === `Hidden Child Selected ${seed}`),
      'other-selected child subspace leaked into sales detail'
    );
    assert.ok(
      !subspaces.some((item) => item.name === `Expired Child ${seed}`),
      'expired child subspace leaked into sales detail'
    );
  });

  it('reflects bound product changes in salesperson-visible space detail and falls back to snapshot after archive', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('sales-space-binding');
    const salesSession = await createAuthenticatedSalesSession(token, `${seed}-primary`, {
      namePrefix: 'Sales Binding Primary',
      store: 'Sales Binding Store',
    });

    const createdProduct = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Sales Space Product ${seed}`,
        spu: `SALESPACE-${seed}`,
        currency: 'CNY',
        brand: 'Sales Brand',
        series: 'Sales Series',
        specifications: {
          material: 'Cotton',
        },
        dimensions: [{ name: '材质', values: ['Leather'] }],
        variants: [
          {
            sku: `SALESPACE-LIVE-${seed}`,
            price: 188,
            cost_price: 99,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { 材质: 'Leather' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = createdProduct.json?.data?.id;
    assert.ok(productId, 'sales-space product id missing');

    const detail = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantId = detail.json?.data?.variants?.[0]?.id;
    assert.ok(variantId, 'sales-space variant id missing');

    const createdSpace = await apiRequest('/api/manage/spaces', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Sales Binding Space ${seed}`,
        description: 'sales-space linkage coverage',
        template: 'product',
        shareMode: 'selected',
        sharedSalespersonIds: [salesSession.salespersonId],
        productId,
        variantId,
        templateData: {
          sku: 'SNAPSHOT-SKU',
          material: 'Snapshot Material',
          brand: 'Snapshot Brand',
          series: 'Snapshot Series',
          images: ['snapshot-main.jpg'],
        },
      },
      expectedStatus: 201,
    });
    const spaceId = createdSpace.json?.data?.id;
    assert.ok(spaceId, 'sales binding space id missing');

    await waitFor(async () => {
      const salesDetail = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/spaces/${spaceId}`,
        { expectedStatus: 200 }
      );
      const templateData = parseTemplateData(salesDetail.json?.data);
      assert.strictEqual(templateData.sku, `SALESPACE-LIVE-${seed}`);
      assert.strictEqual(templateData.material, 'Leather');
      assert.strictEqual(templateData.brand, 'Sales Brand');
      assert.strictEqual(templateData.series, 'Sales Series');
      return templateData;
    }, {
      timeoutMs: 20000,
      intervalMs: 500,
      onTimeoutMessage: 'sales-visible space did not project live bound product data',
    });

    await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const archivedDetail = await salesApiRequest(
        salesSession.accessToken,
        salesSession.jwt,
        `/api/sales/${salesSession.accessToken}/spaces/${spaceId}`,
        { expectedStatus: 200 }
      );
      const templateData = parseTemplateData(archivedDetail.json?.data);
      assert.strictEqual(templateData.sku, 'SNAPSHOT-SKU');
      assert.strictEqual(templateData.material, 'Snapshot Material');
      assert.strictEqual(templateData.brand, 'Snapshot Brand');
      assert.strictEqual(templateData.series, 'Snapshot Series');
      assert.strictEqual(templateData.images?.[0], 'snapshot-main.jpg');
      return templateData;
    }, {
      timeoutMs: 45000,
      intervalMs: 500,
      onTimeoutMessage: 'sales-visible space did not fall back to snapshot after product archive',
    });
  });
});
