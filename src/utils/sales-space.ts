import { parseJsonArray, parseJsonObject } from '@/utils/json.js';

/** 归一化后的空间文件 */
export interface NormalizedSpaceFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

/** 模板数据结构 */
interface TemplateData {
  images?: unknown[];
  [key: string]: unknown;
}

/** 归一化后的子空间 */
export interface NormalizedSubspace {
  id: string;
  name: string;
  shareToken: string;
  fileCount: number;
  templateData: TemplateData;
  coverUrl: string;
  coverImage: string;
  [key: string]: unknown;
}

/** 归一化后的销售空间 */
export interface NormalizedSalesSpace {
  id: string;
  name: string;
  description: string;
  template: string;
  isPublic: boolean;
  shareToken: string;
  fileCount: number;
  templateData: TemplateData;
  files: NormalizedSpaceFile[];
  subspaces: NormalizedSubspace[];
  viewCount: number;
  coverUrl: string;
  [key: string]: unknown;
}

/** 原始文件记录 (可能是字符串或对象) */
interface RawFileRecord {
  id?: string;
  name?: string;
  url?: string;
  file_url?: string;
  storage_key?: string;
  storageKey?: string;
  mimeType?: string;
  mime_type?: string;
  [key: string]: unknown;
}

/** 原始空间数据 (来自 API) */
interface RawSpaceData {
  id?: string;
  name?: string;
  description?: string;
  template?: string;
  isPublic?: boolean;
  is_public?: boolean;
  shareToken?: string;
  share_token?: string;
  file_count?: number;
  fileCount?: number;
  files?: unknown;
  template_data?: string | TemplateData;
  templateData?: string | TemplateData;
  coverUrl?: string;
  cover_url?: string;
  cover_storage_key?: string;
  coverStorageKey?: string;
  p_images?: unknown;
  productImages?: unknown;
  subspaces?: unknown;
  viewCount?: number;
  view_count?: number;
  coverImage?: string;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function pickFirstString(values: unknown[], fallback: string = ''): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function resolveFilePath(path: unknown, storageKey?: unknown): string {
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

function normalizeSpaceFile(raw: unknown, fallbackId: string): NormalizedSpaceFile {
  if (typeof raw === 'string') {
    const url = resolveFilePath(raw);
    return {
      id: fallbackId,
      name: fallbackId,
      url,
      mimeType: '',
    };
  }

  const record = asRecord(raw) as RawFileRecord;
  return {
    id: pickFirstString([record.id], fallbackId),
    name: pickFirstString([record.name], fallbackId),
    url: resolveFilePath(record.url ?? record.file_url, record.storage_key ?? record.storageKey),
    mimeType: pickFirstString([record.mimeType, record.mime_type]),
  };
}

function resolveTemplateImageCover(templateData: TemplateData, productImages: unknown): string {
  const templateImages = parseJsonArray(templateData?.images, [])
    .map((image: unknown, index: number) => normalizeSpaceFile(image, `template-cover-${index}`))
    .filter((file) => file.url);
  if (templateImages[0]?.url) {
    return templateImages[0].url;
  }

  const productImageFiles = parseJsonArray(productImages, [])
    .map((image: unknown, index: number) => normalizeSpaceFile(image, `product-cover-${index}`))
    .filter((file) => file.url);

  return productImageFiles[0]?.url || '';
}

export function normalizeSalesSpace(raw: unknown): NormalizedSalesSpace {
  const record = asRecord(raw) as RawSpaceData;
  const templateData = parseJsonObject(record.template_data ?? record.templateData, {}) as TemplateData;
  const rawFiles = parseJsonArray(record.files, []).map((file: unknown, index: number) =>
    normalizeSpaceFile(file, `space-file-${index}`)
  );
  const templateImages = parseJsonArray(templateData.images, [])
    .map((image: unknown, index: number) => normalizeSpaceFile(image, `template-image-${index}`))
    .filter((file) => file.url);
  const files: NormalizedSpaceFile[] = [
    ...templateImages.filter((candidate) => !rawFiles.some((file) => file.url === candidate.url)),
    ...rawFiles,
  ];
  const coverUrl = resolveFilePath(
    record.coverUrl ?? record.cover_url,
    record.cover_storage_key ?? record.coverStorageKey
  );
  const productImageCandidates = parseJsonArray(record.p_images ?? record.productImages, [])
    .map((image: unknown, index: number) => normalizeSpaceFile(image, `product-image-${index}`))
    .filter((file) => file.url);
  const subspaces: NormalizedSubspace[] = parseJsonArray(record.subspaces, []).map((item: unknown) => {
    const subspace = asRecord(item) as RawSpaceData;
    const subspaceTemplateData = parseJsonObject(subspace.template_data ?? subspace.templateData, {}) as TemplateData;
    const subspaceTemplateImages = parseJsonArray(subspaceTemplateData.images, [])
      .map((image: unknown, index: number) => normalizeSpaceFile(image, `subspace-template-image-${index}`))
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
