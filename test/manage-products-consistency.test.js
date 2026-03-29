import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
} from './utils/manage-products-real-api.js';

describeIfRealApi('Manage Products Real API Query Consistency', function () {
  this.timeout(120000);

  it('keeps list/detail/variants picker consistent on active vs archived variants', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('consistency');
    const spu = `CONS-${seed}`;

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Consistency Product ${seed}`,
        spu,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red', 'Blue'] }],
        variants: [
          {
            sku: `CONS-RED-${seed}`,
            price: 10,
            cost_price: 5,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
          },
          {
            sku: `CONS-BLUE-${seed}`,
            price: 12,
            cost_price: 6,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Blue' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId);

    const detailBefore = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantsBefore = detailBefore.json?.data?.variants || [];
    const blue = variantsBefore.find((v) => v.sku === `CONS-BLUE-${seed}`);
    const red = variantsBefore.find((v) => v.sku === `CONS-RED-${seed}`);
    assert.ok(blue && red);

    // Remove blue from payload => archived
    await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        variants: [
          {
            id: red.id,
            sku: red.sku,
            price: Number(red.price || 10),
            cost_price: Number(red.cost_price || 5),
            stock_quantity: Number(red.stock_quantity || 2),
            alert_threshold: Number(red.alert_threshold || 1),
            status: 'active',
            options_values: red.options_values,
          },
        ],
      },
      expectedStatus: 200,
    });

    const detailAfter = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantsAfter = detailAfter.json?.data?.variants || [];
    const blueAfter = variantsAfter.find((v) => v.id === blue.id);
    assert.ok(blueAfter);
    assert.strictEqual(blueAfter.status, 'archived');

    const picker = await apiRequest(`/api/manage/products/variants?search=${encodeURIComponent(spu)}&page=1&limit=20`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const pickerItems = picker.json?.data || [];
    assert.ok(pickerItems.every((item) => item.variant_id !== blue.id), 'archived variant leaked into picker');
    assert.ok(pickerItems.some((item) => item.variant_id === red.id), 'active variant missing from picker');
  });

  it('supports real list filters, sorting, paging, and deletion visibility consistently', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('filters');
    const sharedBrand = `FilterBrand ${seed}`;
    const sharedCategory = `FilterCategory ${seed}`;

    const alpha = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Alpha ${seed}`,
        spu: `FILTER-A-${seed}`,
        brand: sharedBrand,
        category: sharedCategory,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red'] }],
        variants: [
          {
            sku: `FILTER-A-SKU-${seed}`,
            price: 10,
            cost_price: 5,
            stock_quantity: 6,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const alphaId = alpha.json?.data?.id;
    assert.ok(alphaId);

    const beta = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Beta ${seed}`,
        spu: `FILTER-B-${seed}`,
        brand: sharedBrand,
        category: sharedCategory,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Blue'] }],
        variants: [
          {
            sku: `FILTER-B-SKU-${seed}`,
            price: 12,
            cost_price: 6,
            stock_quantity: 0,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Blue' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const betaId = beta.json?.data?.id;
    assert.ok(betaId);

    const searchAlpha = await apiRequest(`/api/manage/products?search=${encodeURIComponent(`Alpha ${seed}`)}&page=1&limit=10`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const searchItems = searchAlpha.json?.data || [];
    assert.ok(searchItems.some((item) => item.id === alphaId), 'search did not return alpha');
    assert.ok(searchItems.every((item) => item.id !== betaId), 'search leaked unrelated product');

    const brandCategoryFiltered = await apiRequest(
      `/api/manage/products?brand=${encodeURIComponent(sharedBrand)}&category=${encodeURIComponent(sharedCategory)}&page=1&limit=10`,
      {
        bearerToken: token,
        expectedStatus: 200,
      }
    );
    const filteredItems = brandCategoryFiltered.json?.data || [];
    assert.ok(filteredItems.some((item) => item.id === alphaId));
    assert.ok(filteredItems.some((item) => item.id === betaId));

    const inStock = await apiRequest('/api/manage/products?hasStock=in_stock&page=1&limit=50', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const inStockItems = inStock.json?.data || [];
    assert.ok(inStockItems.some((item) => item.id === alphaId), 'in_stock filter missed stocked product');
    assert.ok(inStockItems.every((item) => item.id !== betaId), 'in_stock filter leaked zero-stock product');

    const outOfStock = await apiRequest('/api/manage/products?hasStock=out_of_stock&page=1&limit=50', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const outOfStockItems = outOfStock.json?.data || [];
    assert.ok(outOfStockItems.some((item) => item.id === betaId), 'out_of_stock filter missed zero-stock product');

    const paged = await apiRequest(
      `/api/manage/products?brand=${encodeURIComponent(sharedBrand)}&sortBy=name&sortOrder=asc&page=1&limit=1`,
      {
        bearerToken: token,
        expectedStatus: 200,
      }
    );
    const pagedItems = paged.json?.data || [];
    assert.strictEqual(pagedItems.length, 1);
    assert.strictEqual(pagedItems[0]?.id, alphaId);

    await apiRequest(`/api/manage/products/${alphaId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 200,
    });

    const archived = await apiRequest(
      `/api/manage/products?status=archived&search=${encodeURIComponent(`Alpha ${seed}`)}&page=1&limit=10`,
      {
        bearerToken: token,
        expectedStatus: 200,
      }
    );
    const archivedItems = archived.json?.data || [];
    assert.ok(archivedItems.some((item) => item.id === alphaId), 'archived status filter missed deleted product');

    const active = await apiRequest(
      `/api/manage/products?status=active&search=${encodeURIComponent(`Alpha ${seed}`)}&page=1&limit=10`,
      {
        bearerToken: token,
        expectedStatus: 200,
      }
    );
    const activeItems = active.json?.data || [];
    assert.ok(activeItems.every((item) => item.id !== alphaId), 'active status filter leaked archived product');

    const picker = await apiRequest(`/api/manage/products/variants?search=${encodeURIComponent(`FILTER-A-${seed}`)}&page=1&limit=20`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const pickerItems = picker.json?.data || [];
    assert.ok(pickerItems.every((item) => item.product_id !== alphaId), 'archived product variant leaked into picker');
  });
});
