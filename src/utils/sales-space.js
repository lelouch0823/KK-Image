function asRecord(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function pickFirstString(values, fallback = '') {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function toFiniteNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function safeParseObject(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_error) {
      return fallback;
    }
  }

  return fallback;
}

function safeParseArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_error) {
      return fallback;
    }
  }

  return fallback;
}

function resolveFilePath(path, storageKey) {
  const direct = pickFirstString([path]);
  if (direct) {
    if (
      direct.startsWith('/') ||
      direct.startsWith('http://') ||
      direct.startsWith('https://') ||
      direct.startsWith('data:') ||
      direct.startsWith('blob:')
    ) {
      return direct;
    }

    return `/file/${direct}`;
  }

  const key = pickFirstString([storageKey]);
  if (key) {
    if (
      key.startsWith('/') ||
      key.startsWith('http://') ||
      key.startsWith('https://')
    ) {
      return key;
    }

    return `/file/${key}`;
  }

  return '';
}

function normalizeSpaceFile(raw, fallbackId) {
  if (typeof raw === 'string') {
    const url = resolveFilePath(raw);
    return {
      id: fallbackId,
      name: fallbackId,
      url,
      mimeType: '',
    };
  }

  const record = asRecord(raw);
  return {
    id: pickFirstString([record.id], fallbackId),
    name: pickFirstString([record.name], fallbackId),
    url: resolveFilePath(record.url ?? record.file_url, record.storage_key ?? record.storageKey),
    mimeType: pickFirstString([record.mimeType, record.mime_type]),
  };
}

function resolveTemplateImageCover(templateData, productImages) {
  const templateImages = safeParseArray(templateData?.images, [])
    .map((image, index) => normalizeSpaceFile(image, `template-cover-${index}`))
    .filter((file) => file.url);
  if (templateImages[0]?.url) {
    return templateImages[0].url;
  }

  const productImageFiles = safeParseArray(productImages, [])
    .map((image, index) => normalizeSpaceFile(image, `product-cover-${index}`))
    .filter((file) => file.url);

  return productImageFiles[0]?.url || '';
}

export function normalizeSalesSpace(raw) {
  const record = asRecord(raw);
  const templateData = safeParseObject(record.template_data ?? record.templateData, {});
  const rawFiles = safeParseArray(record.files, []).map((file, index) =>
    normalizeSpaceFile(file, `space-file-${index}`)
  );
  const templateImages = safeParseArray(templateData.images, [])
    .map((image, index) => normalizeSpaceFile(image, `template-image-${index}`))
    .filter((file) => file.url);
  const files = [
    ...templateImages.filter((candidate) => !rawFiles.some((file) => file.url === candidate.url)),
    ...rawFiles,
  ];
  const coverUrl = resolveFilePath(
    record.coverUrl ?? record.cover_url,
    record.cover_storage_key ?? record.coverStorageKey
  );
  const productImageCandidates = safeParseArray(record.p_images ?? record.productImages, [])
    .map((image, index) => normalizeSpaceFile(image, `product-image-${index}`))
    .filter((file) => file.url);
  const subspaces = safeParseArray(record.subspaces, []).map((item) => {
    const subspace = asRecord(item);
    const subspaceTemplateData = safeParseObject(subspace.template_data ?? subspace.templateData, {});
    const subspaceTemplateImages = safeParseArray(subspaceTemplateData.images, [])
      .map((image, index) => normalizeSpaceFile(image, `subspace-template-image-${index}`))
      .filter((file) => file.url);
    const subspaceCoverUrl = resolveFilePath(
      subspace.coverImage ?? subspace.coverUrl ?? subspace.cover_url,
      subspace.cover_storage_key ?? subspace.coverStorageKey
    ) || resolveTemplateImageCover(subspaceTemplateData, subspace.p_images ?? subspace.productImages);
    return {
      ...subspace,
      id: pickFirstString([subspace.id]),
      name: pickFirstString([subspace.name], ''),
      shareToken: pickFirstString([subspace.shareToken, subspace.share_token]),
      fileCount: toFiniteNumber(subspace.fileCount ?? subspace.file_count) || subspaceTemplateImages.length,
      templateData: subspaceTemplateData,
      coverUrl: subspaceCoverUrl,
      coverImage: subspaceCoverUrl,
    };
  });

  return {
    ...record,
    id: pickFirstString([record.id]),
    name: pickFirstString([record.name], ''),
    description: pickFirstString([record.description]),
    template: pickFirstString([record.template], 'gallery'),
    isPublic: Boolean(record.isPublic ?? record.is_public),
    shareToken: pickFirstString([record.shareToken, record.share_token]),
    fileCount: files.length || toFiniteNumber(record.file_count ?? record.fileCount),
    templateData,
    files,
    subspaces,
    viewCount: toFiniteNumber(record.viewCount ?? record.view_count),
    coverUrl: coverUrl || files[0]?.url || productImageCandidates[0]?.url || '',
  };
}
