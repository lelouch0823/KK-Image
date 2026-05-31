import { parseJsonArray, parseJsonObject } from '@/utils/json.js';

function asRecord(value: any): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function pickFirstString(values: any[], fallback: string = ''): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function toFiniteNumber(value: any, fallback: number = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function resolveFilePath(path: any, storageKey?: any): string {
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

function normalizeSpaceFile(raw: any, fallbackId: string): any {
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

function resolveTemplateImageCover(templateData: any, productImages: any): string {
  const templateImages = parseJsonArray(templateData?.images, [])
    .map((image: any, index: number) => normalizeSpaceFile(image, `template-cover-${index}`))
    .filter((file: any) => file.url);
  if (templateImages[0]?.url) {
    return templateImages[0].url;
  }

  const productImageFiles = parseJsonArray(productImages, [])
    .map((image: any, index: number) => normalizeSpaceFile(image, `product-cover-${index}`))
    .filter((file: any) => file.url);

  return productImageFiles[0]?.url || '';
}

export function normalizeSalesSpace(raw: any): any {
  const record = asRecord(raw);
  const templateData = parseJsonObject(record.template_data ?? record.templateData, {});
  const rawFiles = parseJsonArray(record.files, []).map((file: any, index: number) =>
    normalizeSpaceFile(file, `space-file-${index}`)
  );
  const templateImages = parseJsonArray(templateData.images, [])
    .map((image: any, index: number) => normalizeSpaceFile(image, `template-image-${index}`))
    .filter((file: any) => file.url);
  const files = [
    ...templateImages.filter((candidate: any) => !rawFiles.some((file: any) => file.url === candidate.url)),
    ...rawFiles,
  ];
  const coverUrl = resolveFilePath(
    record.coverUrl ?? record.cover_url,
    record.cover_storage_key ?? record.coverStorageKey
  );
  const productImageCandidates = parseJsonArray(record.p_images ?? record.productImages, [])
    .map((image: any, index: number) => normalizeSpaceFile(image, `product-image-${index}`))
    .filter((file: any) => file.url);
  const subspaces = parseJsonArray(record.subspaces, []).map((item: any) => {
    const subspace = asRecord(item);
    const subspaceTemplateData = parseJsonObject(subspace.template_data ?? subspace.templateData, {});
    const subspaceTemplateImages = parseJsonArray(subspaceTemplateData.images, [])
      .map((image: any, index: number) => normalizeSpaceFile(image, `subspace-template-image-${index}`))
      .filter((file: any) => file.url);
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
