/**
 * 共享空间数据转换器
 * 将数据库记录转换为 API 响应格式
 */

import { getShareUrl, getFileUrl } from '../../../../../_shared/utils.js';
import { parseJsonArray, parseJsonObject } from '../../../../../api/utils/json.js';
import { normalizeVariantOptions } from '../../../../../lib/utils/variant-meta.js';

export function resolveSpaceBindingState(space = {}) {
  const hasProductBinding = Boolean(space.product_id);
  const hasVariantBinding = Boolean(space.variant_id);

  if (!hasProductBinding && !hasVariantBinding) return 'unbound';
  if (hasProductBinding && !space.p_bound_id) return 'missing_product';
  if (hasVariantBinding && !space.pv_bound_id) return 'missing_variant';

  const productStatus = String(space.p_status || '').trim().toLowerCase();
  if (hasProductBinding && productStatus && productStatus !== 'active') {
    return 'archived_product';
  }

  const variantStatus = String(space.pv_status || '').trim().toLowerCase();
  if (hasVariantBinding && variantStatus && variantStatus !== 'active') {
    return 'archived_variant';
  }

  return 'active';
}

function hasBindingSnapshotFallback(space = {}) {
  const bindingState = resolveSpaceBindingState(space);
  return bindingState !== 'unbound' && bindingState !== 'active';
}

function normalizeProjectedVariantOptions(space = {}) {
  const rawOptions = parseJsonObject(space.pv_options_values, {});
  const dimensionMap = parseJsonObject(space.p_dimension_map, {});
  if (!dimensionMap || Object.keys(dimensionMap).length === 0) {
    return normalizeVariantOptions(rawOptions);
  }

  const readableOptions = Object.entries(rawOptions).reduce((acc, [key, value]) => {
    const readableKey = String(dimensionMap[key] || key || '').trim();
    if (!readableKey) return acc;
    acc[readableKey] = value;
    return acc;
  }, {});

  return normalizeVariantOptions(readableOptions);
}

/**
 * 投影商品字段到空间模版数据中
 * @param {Object} space 
 * @returns {Object} 包含商品字段的 templateData
 */
export function projectSpaceTemplateData(space) {
  const templateData = parseJsonObject(space.template_data, {});
  const productStatus = String(space.p_status || '').trim().toLowerCase();
  const variantStatus = String(space.pv_status || '').trim().toLowerCase();
  const hasActiveProductBinding = !space.product_id || !productStatus || productStatus === 'active';
  const hasActiveVariantBinding = !space.variant_id || !variantStatus || variantStatus === 'active';

  // 如果绑定了产品，用产品表 JOIN 过来的数据覆盖空间的模板字段
  if (space.product_id && hasActiveProductBinding && hasActiveVariantBinding) {
    if (space.p_brand !== undefined) templateData.brand = space.p_brand || '';
    if (space.p_series !== undefined) templateData.series = space.p_series || '';
    const projectedSku = space.variant_id
      ? (space.pv_sku || space.p_sku || '')
      : (space.p_sku || '');
    if (space.p_sku !== undefined || space.pv_sku !== undefined) templateData.sku = projectedSku;
    if (space.p_price !== undefined) templateData.price = space.p_price !== null ? String(space.p_price) : '';

    if (space.p_specs) {
      const specs = parseJsonObject(space.p_specs, {});
      if (specs?.material) templateData.material = specs.material || '';
    }

    if (space.variant_id && space.pv_options_values) {
      const variantOptions = normalizeProjectedVariantOptions(space);
      if (variantOptions.material) {
        templateData.material = variantOptions.material;
      }
    }

    if (space.p_images) {
      const productImages = parseJsonArray(space.p_images, []);
      const variantImage = String(space.display_image_id || '').trim();
      templateData.images = variantImage
        ? [variantImage, ...productImages.filter((image) => image !== variantImage)]
        : productImages;
    }
  }

  return templateData;
}

/**
 * 转换空间列表项
 * @param {Object} space - 数据库空间记录
 * @returns {Object} API 响应格式
 */
export function transformSpaceListItem(space) {
  const bindingState = resolveSpaceBindingState(space);
  return {
    id: space.id,
    name: space.name,
    description: space.description,
    isPublic: Boolean(space.is_public),
    hasPassword: !!space.password,
    shareToken: space.share_token,
    shareUrl: getShareUrl(space.share_token, 'space'),
    shareMode: space.share_mode || 'none',
    fileCount: space.file_count || 0,
    expiresAt: space.expires_at,
    template: space.template,
    coverFileId: space.cover_file_id,
    coverUrl: space.cover_storage_key
      ? (space.cover_storage_key.startsWith('http') ? space.cover_storage_key : getFileUrl(space.cover_storage_key))
      : null,
    viewCount: space.view_count || 0,
    productId: space.product_id || null,
    variantId: space.variant_id || null,
    bindingState,
    bindingUsesSnapshot: hasBindingSnapshotFallback(space),
    createdAt: space.created_at,
    updatedAt: space.updated_at,
  };
}

/**
 * 转换空间详情
 * @param {Object} space - 数据库空间记录
 * @param {Array} files - 关联文件列表
 * @returns {Object} API 响应格式
 */
export function transformSpaceDetail(space, files = []) {
  const bindingState = resolveSpaceBindingState(space);
  return {
    id: space.id,
    name: space.name,
    description: space.description,
    isPublic: Boolean(space.is_public),
    hasPassword: !!space.password,
    shareToken: space.share_token,
    shareUrl: getShareUrl(space.share_token, 'space'),
    shareMode: space.share_mode || 'none',
    expiresAt: space.expires_at,
    template: space.template,
    templateData: projectSpaceTemplateData(space),
    coverFileId: space.cover_file_id,
    coverUrl: space.cover_storage_key
      ? (space.cover_storage_key.startsWith('http') ? space.cover_storage_key : getFileUrl(space.cover_storage_key))
      : null,
    viewCount: space.view_count,
    productId: space.product_id || null,
    variantId: space.variant_id || null,
    bindingState,
    bindingUsesSnapshot: hasBindingSnapshotFallback(space),
    createdAt: space.created_at,
    updatedAt: space.updated_at,
    files: files.map(transformFile),
  };
}

/**
 * 转换文件记录
 * @param {Object} file - 数据库文件记录
 * @returns {Object} API 响应格式
 */
function transformFile(file) {
  return {
    id: file.id,
    name: file.name,
    originalName: file.original_name,
    size: file.size,
    mimeType: file.mime_type,
    url: getFileUrl(file.storage_key),
    blurhash: file.blurhash,
    createdAt: file.created_at,
  };
}
