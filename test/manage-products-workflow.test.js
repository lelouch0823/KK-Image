import assert from 'assert';
import { vi } from 'vitest';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
} from './utils/manage-products-real-api.js';

describeIfRealApi('Manage Products Real API Workflow', function () {
  vi.setConfig({ testTimeout: 120000 });

  let productId = '';
  let colorDimensionId = '';
  let redValueId = '';
  let materialDimensionId = '';
  let keepVariantId = '';
  let removedVariantId = '';
  let authHeader = '';

  const unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const productName = `Workflow Product ${unique}`;
  const productSpu = `WF-${unique}`;

  it('runs end-to-end product/dimension/variant workflow', async () => {
    const token = await getBearerToken();
    authHeader = `Bearer ${token}`;

    {
      const { json } = await apiRequest('/api/manage/products?page=1&limit=10', {
        authHeader,
        expectedStatus: 200,
      });
      assert.strictEqual(json?.success, true);
      assert.ok(Array.isArray(json?.data));
    }

    {
      const payload = {
        name: productName,
        spu: productSpu,
        brand: 'WorkflowBrand',
        category: 'WorkflowCategory',
        currency: 'CNY',
        dimensions: [
          { name: 'Color', values: ['Red', 'Blue'] },
          { name: 'Size', values: ['S', 'M'] },
        ],
        variants: [
          {
            sku: `SKU-${unique}-RED-S`,
            price: 100,
            cost_price: 60,
            stock_quantity: 10,
            alert_threshold: 2,
            status: 'active',
            options_values: { Color: 'Red', Size: 'S' },
          },
          {
            sku: `SKU-${unique}-BLUE-M`,
            price: 120,
            cost_price: 70,
            stock_quantity: 8,
            alert_threshold: 2,
            status: 'active',
            options_values: { Color: 'Blue', Size: 'M' },
          },
        ],
      };

      const { json } = await apiRequest('/api/manage/products', {
        authHeader,
        method: 'POST',
        body: payload,
        expectedStatus: 201,
      });
      assert.strictEqual(json?.success, true);
      productId = json?.data?.id;
      assert.ok(productId, 'created product id missing');
    }

    {
      const { json } = await apiRequest(`/api/manage/products/${productId}`, {
        authHeader,
        expectedStatus: 200,
      });
      assert.strictEqual(json?.success, true);
      assert.strictEqual(json?.data?.id, productId);
      assert.ok(Array.isArray(json?.data?.dimensions));
      assert.ok(Array.isArray(json?.data?.variants));

      const dimensions = json.data.dimensions;
      const variants = json.data.variants;
      for (const variant of variants) {
        assert.ok(Object.prototype.hasOwnProperty.call(variant, 'replenishment_quantity'));
        assert.ok(Object.prototype.hasOwnProperty.call(variant, 'replenishment_po_count'));
      }
      const colorDimension = dimensions.find((d) => d.name === 'Color');
      const redValue = colorDimension?.values?.find((v) => v.value === 'Red');
      assert.ok(colorDimension?.id, 'Color dimension id missing');
      assert.ok(redValue?.id, 'Red value id missing');
      assert.ok(variants.length >= 2, 'expected at least 2 variants after create');

      colorDimensionId = colorDimension.id;
      redValueId = redValue.id;
      keepVariantId = variants[0].id;
      removedVariantId = variants[1].id;
    }

    {
      const createdDim = await apiRequest(`/api/manage/products/${productId}/dimensions`, {
        authHeader,
        method: 'POST',
        body: { name: 'Material' },
        expectedStatus: 201,
      });
      assert.strictEqual(createdDim.json?.success, true);
      materialDimensionId = createdDim.json?.data?.id;
      assert.ok(materialDimensionId, 'Material dimension id missing');

      const createdValue = await apiRequest(`/api/manage/products/${productId}/dimensions/${materialDimensionId}/values`, {
        authHeader,
        method: 'POST',
        body: { value: 'Cotton' },
        expectedStatus: 201,
      });
      assert.strictEqual(createdValue.json?.success, true);
      assert.ok(createdValue.json?.data?.id, 'Material value id missing');
    }

    {
      const patchPayload = {
        name: `${productName} Updated`,
        variants: [
          {
            id: keepVariantId,
            sku: `SKU-${unique}-RED-S`,
            price: 130,
            cost_price: 80,
            stock_quantity: 12,
            alert_threshold: 3,
            status: 'active',
            options_values: { Color: 'Red', Size: 'S' },
          },
          {
            sku: `SKU-${unique}-BLUE-S-COTTON`,
            price: 150,
            cost_price: 90,
            stock_quantity: 6,
            alert_threshold: 2,
            status: 'active',
            options_values: { Color: 'Blue', Size: 'S', Material: 'Cotton' },
          },
        ],
      };

      const { json } = await apiRequest(`/api/manage/products/${productId}`, {
        authHeader,
        method: 'PATCH',
        body: patchPayload,
        expectedStatus: 200,
      });
      assert.strictEqual(json?.success, true);
      assert.ok(json?.variantSync, 'variantSync missing in PATCH response');
      assert.ok(Number(json.variantSync.updated) >= 1, 'expected at least 1 updated variant');
      assert.ok(Number(json.variantSync.archived) >= 1, 'expected at least 1 archived variant');
      assert.ok(Number(json.variantSync.created) >= 1, 'expected at least 1 created variant');
    }

    {
      const { json } = await apiRequest(`/api/manage/products/${productId}`, {
        authHeader,
        expectedStatus: 200,
      });
      const variants = json?.data?.variants || [];
      const removed = variants.find((v) => v.id === removedVariantId);
      const kept = variants.find((v) => v.id === keepVariantId);
      assert.ok(removed, 'removed variant should still exist as archived record');
      assert.strictEqual(removed.status, 'archived');
      assert.ok(kept, 'kept variant missing after patch');
      assert.strictEqual(kept.status, 'active');
    }

    {
      const archived = await apiRequest(`/api/manage/products/${productId}/values/${redValueId}/archive`, {
        authHeader,
        method: 'PATCH',
        expectedStatus: 200,
      });
      assert.strictEqual(archived.json?.success, true);

      const restored = await apiRequest(`/api/manage/products/${productId}/values/${redValueId}/restore`, {
        authHeader,
        method: 'PATCH',
        expectedStatus: 200,
      });
      assert.strictEqual(restored.json?.success, true);
    }

    {
      const { json } = await apiRequest(`/api/manage/products/${productId}`, {
        authHeader,
        expectedStatus: 200,
      });
      assert.strictEqual(json?.success, true);

      const variants = json.data.variants || [];
      const removed = variants.find((v) => v.id === removedVariantId);
      const kept = variants.find((v) => v.id === keepVariantId);

      assert.ok(removed, 'removed variant should still exist as archived record');
      assert.strictEqual(removed.status, 'archived');
      assert.ok(kept, 'kept variant missing after patch');
      assert.strictEqual(
        kept.status,
        'archived',
        'affected variant remains archived after value restore (current business rule)'
      );
    }

    {
      const del = await apiRequest(`/api/manage/products/${productId}`, {
        authHeader,
        method: 'DELETE',
        expectedStatus: 200,
      });
      assert.strictEqual(del.json?.success, true);

      const { json } = await apiRequest(`/api/manage/products/${productId}`, {
        authHeader,
        expectedStatus: 200,
      });
      const variants = json?.data?.variants || [];
      assert.ok(variants.length > 0, 'expected variants to exist for archive check');
      assert.ok(variants.every((v) => v.status === 'archived'), 'not all variants are archived');
    }
  });
});
