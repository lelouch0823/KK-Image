import assert from 'assert';
import { vi } from 'vitest';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
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

  it('rolls back product fields and dimensions when patch variant sync fails', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('patch-rollback');

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Patch Rollback ${seed}`,
        spu: `PATCH-RB-${seed}`,
        brand: 'RollbackBrand',
        category: 'RollbackCategory',
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red', 'Blue'] }],
        variants: [
          {
            sku: `PATCH-RB-RED-${seed}`,
            price: 100,
            cost_price: 60,
            stock_quantity: 5,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
            barcode: `PATCH-RB-BC-${seed}`,
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId, 'created product id missing');

    const before = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const beforeDetail = before.json?.data;
    const colorDimension = (beforeDetail?.dimensions || []).find((item) => item.name === 'Color');
    const redVariant = (beforeDetail?.variants || []).find((item) => item.sku === `PATCH-RB-RED-${seed}`);
    assert.ok(colorDimension?.id, 'color dimension id missing');
    assert.ok(redVariant?.id, 'original variant id missing');

    const failedPatch = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      method: 'PATCH',
      body: {
        name: `Patch Rollback ${seed} Updated`,
        dimensions: [
          {
            id: colorDimension.id,
            name: 'Color',
            values: ['Red', 'Blue'],
          },
          {
            name: 'Material',
            values: ['Cotton'],
          },
        ],
        variants: [
          {
            id: redVariant.id,
            sku: redVariant.sku,
            price: 111,
            cost_price: 61,
            stock_quantity: 6,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
            barcode: `PATCH-RB-BC-${seed}`,
          },
          {
            sku: `PATCH-RB-BLUE-${seed}`,
            price: 122,
            cost_price: 70,
            stock_quantity: 4,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Blue', Material: 'Cotton' },
            barcode: `PATCH-RB-BC-${seed}`,
          },
        ],
      },
    });
    assert.ok([400, 409, 500].includes(failedPatch.response.status), `unexpected patch failure status: ${failedPatch.response.status}`);

    const after = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const afterDetail = after.json?.data;
    const afterVariants = afterDetail?.variants || [];
    const afterDimensions = afterDetail?.dimensions || [];
    const redAfter = afterVariants.find((item) => item.id === redVariant.id);
    const materialAfter = afterDimensions.find((item) => item.name === 'Material');

    assert.strictEqual(afterDetail?.name, `Patch Rollback ${seed}`);
    assert.strictEqual(afterDimensions.filter((item) => item.status !== 'archived').length, 1);
    assert.strictEqual(materialAfter?.status, 'archived');
    assert.strictEqual(afterVariants.length, 1);
    assert.ok(redAfter, 'original variant missing after failed patch');
    assert.strictEqual(redAfter.price, 100);
    assert.strictEqual(Number(redAfter.stock_quantity || 0), 5);
    assert.strictEqual(redAfter.barcode, `PATCH-RB-BC-${seed}`);
  });

  it('full replace archives missing variants, dimensions, and values while keeping retained ones active', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('put-replace');

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Replace Product ${seed}`,
        spu: `PUT-${seed}`,
        brand: 'ReplaceBrand',
        category: 'ReplaceCategory',
        currency: 'CNY',
        dimensions: [
          { name: 'Color', values: ['Red', 'Blue'] },
          { name: 'Size', values: ['S', 'M'] },
        ],
        variants: [
          {
            sku: `PUT-RED-S-${seed}`,
            price: 90,
            cost_price: 50,
            stock_quantity: 5,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red', Size: 'S' },
          },
          {
            sku: `PUT-BLUE-M-${seed}`,
            price: 95,
            cost_price: 55,
            stock_quantity: 3,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Blue', Size: 'M' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId, 'created product id missing');

    const before = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const beforeDetail = before.json?.data;
    const colorDimension = (beforeDetail?.dimensions || []).find((item) => item.name === 'Color');
    const sizeDimension = (beforeDetail?.dimensions || []).find((item) => item.name === 'Size');
    const redValue = colorDimension?.values?.find((item) => item.value === 'Red');
    const blueValue = colorDimension?.values?.find((item) => item.value === 'Blue');
    const redVariant = (beforeDetail?.variants || []).find((item) => item.sku === `PUT-RED-S-${seed}`);
    const blueVariant = (beforeDetail?.variants || []).find((item) => item.sku === `PUT-BLUE-M-${seed}`);
    assert.ok(colorDimension?.id && sizeDimension?.id && redValue?.id && blueValue?.id, 'dimension ids missing before replace');
    assert.ok(redVariant?.id && blueVariant?.id, 'variant ids missing before replace');

    const replaced = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      method: 'PUT',
      body: {
        name: `Replace Product ${seed} Final`,
        spu: `PUT-${seed}`,
        brand: 'ReplaceBrand',
        category: 'ReplaceCategory',
        currency: 'CNY',
        dimensions: [
          {
            id: colorDimension.id,
            name: 'Color',
            values: ['Red'],
          },
        ],
        variants: [
          {
            id: redVariant.id,
            sku: redVariant.sku,
            price: 101,
            cost_price: 60,
            stock_quantity: 7,
            alert_threshold: 2,
            status: 'active',
            options_values: { Color: 'Red' },
          },
        ],
      },
      expectedStatus: 200,
    });
    assert.strictEqual(replaced.json?.success, true);
    assert.ok(Number(replaced.json?.variantSync?.archived || 0) >= 1, 'expected archived variants during full replace');

    const after = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const afterDetail = after.json?.data;
    const afterColor = (afterDetail?.dimensions || []).find((item) => item.id === colorDimension.id);
    const afterSize = (afterDetail?.dimensions || []).find((item) => item.id === sizeDimension.id);
    const afterRedValue = afterColor?.values?.find((item) => item.id === redValue.id);
    const afterBlueValue = afterColor?.values?.find((item) => item.id === blueValue.id);
    const redAfter = (afterDetail?.variants || []).find((item) => item.id === redVariant.id);
    const blueAfter = (afterDetail?.variants || []).find((item) => item.id === blueVariant.id);

    assert.strictEqual(afterDetail?.name, `Replace Product ${seed} Final`);
    assert.strictEqual(afterColor?.status, 'active');
    assert.strictEqual(afterRedValue?.status, 'active');
    assert.strictEqual(afterBlueValue?.status, 'archived');
    assert.strictEqual(afterSize?.status, 'archived');
    assert.strictEqual(redAfter?.status, 'active');
    assert.strictEqual(redAfter?.price, 101);
    assert.strictEqual(Number(redAfter?.stock_quantity || 0), 7);
    assert.strictEqual(blueAfter?.status, 'archived');
  });

  it('previews dimension impact and archives affected variants in archive_variants mode', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('dimension-archive');

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Dimension Archive ${seed}`,
        spu: `DIM-ARCH-${seed}`,
        currency: 'CNY',
        dimensions: [
          { name: 'Color', values: ['Red', 'Blue'] },
          { name: 'Size', values: ['S', 'M'] },
        ],
        variants: [
          {
            sku: `DIM-ARCH-RED-S-${seed}`,
            price: 50,
            cost_price: 25,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red', Size: 'S' },
          },
          {
            sku: `DIM-ARCH-BLUE-M-${seed}`,
            price: 55,
            cost_price: 28,
            stock_quantity: 3,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Blue', Size: 'M' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId);

    const before = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const colorDimension = (before.json?.data?.dimensions || []).find((item) => item.name === 'Color');
    assert.ok(colorDimension?.id, 'color dimension id missing');

    const impact = await apiRequest(`/api/manage/products/${productId}/dimensions/impact`, {
      bearerToken: token,
      method: 'POST',
      body: {
        action: 'archive_dimension',
        dimensionId: colorDimension.id,
      },
      expectedStatus: 200,
    });
    assert.strictEqual(Number(impact.json?.data?.affectedVariantsCount || 0), 2);

    const archived = await apiRequest(`/api/manage/products/${productId}/dimensions/${colorDimension.id}/archive`, {
      bearerToken: token,
      method: 'PATCH',
      body: { mode: 'archive_variants' },
      expectedStatus: 200,
    });
    assert.ok(Number(archived.json?.data?.effect?.archivedVariants || 0) >= 2);

    const after = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const afterColor = (after.json?.data?.dimensions || []).find((item) => item.id === colorDimension.id);
    const afterVariants = after.json?.data?.variants || [];
    assert.strictEqual(afterColor?.status, 'archived');
    assert.ok(afterVariants.every((item) => item.status === 'archived'));
  });

  it('renames a dimension, updates sort order, and records alias history', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('dimension-rename');

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Dimension Rename ${seed}`,
        spu: `DIM-RENAME-${seed}`,
        currency: 'CNY',
        dimensions: [
          { name: 'Color', values: ['Red'] },
          { name: 'Size', values: ['S'] },
        ],
        variants: [
          {
            sku: `DIM-RENAME-RED-S-${seed}`,
            price: 66,
            cost_price: 33,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red', Size: 'S' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId);

    const before = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const colorDimension = (before.json?.data?.dimensions || []).find((item) => item.name === 'Color');
    const sizeDimension = (before.json?.data?.dimensions || []).find((item) => item.name === 'Size');
    const variant = before.json?.data?.variants?.[0];
    assert.ok(colorDimension?.id && sizeDimension?.id && variant?.id, 'dimension or variant ids missing');

    const updated = await apiRequest(`/api/manage/products/${productId}/dimensions/${colorDimension.id}`, {
      bearerToken: token,
      method: 'PATCH',
      body: { name: 'Tone', sort_order: 3 },
      expectedStatus: 200,
    });
    assert.strictEqual(updated.json?.success, true);

    const after = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const renamed = (after.json?.data?.dimensions || []).find((item) => item.id === colorDimension.id);
    const afterVariant = (after.json?.data?.variants || []).find((item) => item.id === variant.id);
    assert.strictEqual(renamed?.name, 'Tone');
    assert.strictEqual(Number(renamed?.sort_order), 3);
    assert.ok((renamed?.aliases || []).some((item) => item.from_name === 'Color' && item.to_name === 'Tone'));
    assert.strictEqual((afterVariant?.options_values || {})[colorDimension.id], 'Red');
    assert.strictEqual((afterVariant?.options_values || {})[sizeDimension.id], 'S');
  });

  it('previews and archives a single value without affecting sibling value variants', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('value-impact');

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Value Impact ${seed}`,
        spu: `VALUE-IMPACT-${seed}`,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red', 'Blue'] }],
        variants: [
          {
            sku: `VALUE-RED-${seed}`,
            price: 44,
            cost_price: 22,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
          },
          {
            sku: `VALUE-BLUE-${seed}`,
            price: 45,
            cost_price: 23,
            stock_quantity: 3,
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

    const before = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const colorDimension = (before.json?.data?.dimensions || []).find((item) => item.name === 'Color');
    const redValue = colorDimension?.values?.find((item) => item.value === 'Red');
    const blueValue = colorDimension?.values?.find((item) => item.value === 'Blue');
    const redVariant = (before.json?.data?.variants || []).find((item) => item.sku === `VALUE-RED-${seed}`);
    const blueVariant = (before.json?.data?.variants || []).find((item) => item.sku === `VALUE-BLUE-${seed}`);
    assert.ok(redValue?.id && blueValue?.id && redVariant?.id && blueVariant?.id);

    const impact = await apiRequest(`/api/manage/products/${productId}/dimensions/impact`, {
      bearerToken: token,
      method: 'POST',
      body: {
        action: 'archive_value',
        valueId: redValue.id,
      },
      expectedStatus: 200,
    });
    assert.strictEqual(Number(impact.json?.data?.affectedVariantsCount || 0), 1);

    const archived = await apiRequest(`/api/manage/products/${productId}/values/${redValue.id}/archive`, {
      bearerToken: token,
      method: 'PATCH',
      expectedStatus: 200,
    });
    assert.strictEqual(Number(archived.json?.data?.effect?.changes || 0), 1);

    const afterArchive = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const afterColor = (afterArchive.json?.data?.dimensions || []).find((item) => item.id === colorDimension.id);
    const afterRedValue = afterColor?.values?.find((item) => item.id === redValue.id);
    const afterBlueValue = afterColor?.values?.find((item) => item.id === blueValue.id);
    const redAfterArchive = (afterArchive.json?.data?.variants || []).find((item) => item.id === redVariant.id);
    const blueAfterArchive = (afterArchive.json?.data?.variants || []).find((item) => item.id === blueVariant.id);
    assert.strictEqual(afterRedValue?.status, 'archived');
    assert.strictEqual(afterBlueValue?.status, 'active');
    assert.strictEqual(redAfterArchive?.status, 'archived');
    assert.strictEqual(blueAfterArchive?.status, 'active');

    const restored = await apiRequest(`/api/manage/products/${productId}/values/${redValue.id}/restore`, {
      bearerToken: token,
      method: 'PATCH',
      expectedStatus: 200,
    });
    assert.strictEqual(restored.json?.success, true);

    const afterRestore = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const restoredColor = (afterRestore.json?.data?.dimensions || []).find((item) => item.id === colorDimension.id);
    const restoredRedValue = restoredColor?.values?.find((item) => item.id === redValue.id);
    const redAfterRestore = (afterRestore.json?.data?.variants || []).find((item) => item.id === redVariant.id);
    const blueAfterRestore = (afterRestore.json?.data?.variants || []).find((item) => item.id === blueVariant.id);
    assert.strictEqual(restoredRedValue?.status, 'active');
    assert.strictEqual(redAfterRestore?.status, 'archived');
    assert.strictEqual(blueAfterRestore?.status, 'active');
  });

  it('merges away a dimension in merge_keep mode and deduplicates overlapping variants', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('dimension-merge');

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Dimension Merge ${seed}`,
        spu: `DIM-MERGE-${seed}`,
        currency: 'CNY',
        dimensions: [
          { name: 'Color', values: ['Red'] },
          { name: 'Size', values: ['S', 'M'] },
        ],
        variants: [
          {
            sku: `DIM-MERGE-RED-S-${seed}`,
            price: 60,
            cost_price: 30,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red', Size: 'S' },
          },
          {
            sku: `DIM-MERGE-RED-M-${seed}`,
            price: 60,
            cost_price: 30,
            stock_quantity: 4,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red', Size: 'M' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId);

    const before = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const sizeDimension = (before.json?.data?.dimensions || []).find((item) => item.name === 'Size');
    const colorDimension = (before.json?.data?.dimensions || []).find((item) => item.name === 'Color');
    assert.ok(sizeDimension?.id && colorDimension?.id);

    const merged = await apiRequest(`/api/manage/products/${productId}/dimensions/${sizeDimension.id}/archive`, {
      bearerToken: token,
      method: 'PATCH',
      body: { mode: 'merge_keep' },
      expectedStatus: 200,
    });
    assert.ok(Number(merged.json?.data?.effect?.deduped || 0) >= 1);

    const after = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const afterSize = (after.json?.data?.dimensions || []).find((item) => item.id === sizeDimension.id);
    const activeVariants = (after.json?.data?.variants || []).filter((item) => item.status === 'active');
    const archivedVariants = (after.json?.data?.variants || []).filter((item) => item.status === 'archived');
    assert.strictEqual(afterSize?.status, 'archived');
    assert.strictEqual(activeVariants.length, 1);
    assert.ok(archivedVariants.length >= 1);
    assert.deepStrictEqual(Object.keys(activeVariants[0]?.options_values || {}), [colorDimension.id]);
  });

  it('manages variant images through add, sort, primary switch, and delete flows', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('variant-images');

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Variant Images ${seed}`,
        spu: `IMG-${seed}`,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red'] }],
        variants: [
          {
            sku: `IMG-RED-${seed}`,
            price: 70,
            cost_price: 35,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId);

    const before = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantId = before.json?.data?.variants?.[0]?.id;
    assert.ok(variantId, 'variant id missing');
    const imageA = await apiRequest('/api/v1/files', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `variant-a-${seed}.txt`,
        isPublic: false,
      },
      expectedStatus: 201,
    });
    const imageAId = imageA.json?.data?.id;
    assert.ok(imageAId, 'image a id missing');
    const imageB = await apiRequest('/api/v1/files', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `variant-b-${seed}.txt`,
        isPublic: false,
      },
      expectedStatus: 201,
    });
    const imageBId = imageB.json?.data?.id;
    assert.ok(imageBId, 'image b id missing');

    await apiRequest(`/api/manage/products/${productId}/variants/${variantId}/images`, {
      bearerToken: token,
      method: 'POST',
      body: { imageId: imageAId, isPrimary: true },
      expectedStatus: 201,
    });
    await apiRequest(`/api/manage/products/${productId}/variants/${variantId}/images`, {
      bearerToken: token,
      method: 'POST',
      body: { imageId: imageBId, isPrimary: false },
      expectedStatus: 201,
    });

    await apiRequest(`/api/manage/products/${productId}/variants/${variantId}/images/sort`, {
      bearerToken: token,
      method: 'PATCH',
      body: { imageIds: [imageBId, imageAId] },
      expectedStatus: 200,
    });
    await apiRequest(`/api/manage/products/${productId}/variants/${variantId}/images/${imageBId}/primary`, {
      bearerToken: token,
      method: 'PATCH',
      expectedStatus: 200,
    });

    const sorted = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const sortedVariant = (sorted.json?.data?.variants || []).find((item) => item.id === variantId);
    assert.strictEqual(sortedVariant?.primaryImage, imageBId);
    assert.strictEqual(sortedVariant?.images?.[0]?.image_id, imageBId);
    assert.strictEqual(sortedVariant?.images?.[1]?.image_id, imageAId);

    await apiRequest(`/api/manage/products/${productId}/variants/${variantId}/images/${imageAId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 200,
    });

    const afterDelete = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const afterVariant = (afterDelete.json?.data?.variants || []).find((item) => item.id === variantId);
    assert.strictEqual(afterVariant?.images?.length, 1);
    assert.strictEqual(afterVariant?.images?.[0]?.image_id, imageBId);
    assert.strictEqual(afterVariant?.primaryImage, imageBId);
  });

  it('falls back to the remaining image after deleting the primary and rejects non-owned variant image writes', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('variant-image-boundary');

    const created = await apiRequest('/api/manage/products', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Variant Image Boundary ${seed}`,
        spu: `IMG-B-${seed}`,
        currency: 'CNY',
        dimensions: [{ name: 'Color', values: ['Red'] }],
        variants: [
          {
            sku: `IMG-B-RED-${seed}`,
            price: 71,
            cost_price: 36,
            stock_quantity: 2,
            alert_threshold: 1,
            status: 'active',
            options_values: { Color: 'Red' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = created.json?.data?.id;
    assert.ok(productId);

    const before = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const variantId = before.json?.data?.variants?.[0]?.id;
    assert.ok(variantId, 'variant id missing');

    const imageA = await apiRequest('/api/v1/files', {
      bearerToken: token,
      method: 'POST',
      body: { name: `variant-boundary-a-${seed}.txt`, isPublic: false },
      expectedStatus: 201,
    });
    const imageAId = imageA.json?.data?.id;
    const imageB = await apiRequest('/api/v1/files', {
      bearerToken: token,
      method: 'POST',
      body: { name: `variant-boundary-b-${seed}.txt`, isPublic: false },
      expectedStatus: 201,
    });
    const imageBId = imageB.json?.data?.id;
    assert.ok(imageAId && imageBId);

    await apiRequest(`/api/manage/products/${productId}/variants/${variantId}/images`, {
      bearerToken: token,
      method: 'POST',
      body: { imageId: imageAId, isPrimary: true },
      expectedStatus: 201,
    });
    await apiRequest(`/api/manage/products/${productId}/variants/${variantId}/images`, {
      bearerToken: token,
      method: 'POST',
      body: { imageId: imageBId, isPrimary: false },
      expectedStatus: 201,
    });

    await apiRequest(`/api/manage/products/${productId}/variants/${variantId}/images/${imageAId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 200,
    });

    const afterDelete = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    const afterVariant = (afterDelete.json?.data?.variants || []).find((item) => item.id === variantId);
    assert.strictEqual(afterVariant?.images?.length, 1);
    assert.strictEqual(afterVariant?.images?.[0]?.image_id, imageBId);
    assert.strictEqual(afterVariant?.primaryImage, imageBId);

    const invalidWrite = await apiRequest(`/api/manage/products/${productId}/variants/not-owned-${seed}/images`, {
      bearerToken: token,
      method: 'POST',
      body: { imageId: imageBId, isPrimary: true },
    });
    assert.strictEqual(invalidWrite.response.status, 400);
    assert.ok(String(invalidWrite.json?.error || '').includes('Variant does not belong to product'));
  });
});
