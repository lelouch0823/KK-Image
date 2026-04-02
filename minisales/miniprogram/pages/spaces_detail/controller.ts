import { formatDateTime, pickFirstString, toFiniteNumber } from '../../utils/helpers';

type UnknownRecord = Record<string, unknown>;

export interface SpaceDetailFileViewModel {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  section: string;
  isImage: boolean;
  isVideo: boolean;
}

export interface SpaceDetailSubspaceViewModel {
  id: string;
  name: string;
  fileCount: number;
  coverUrl: string;
}

export interface SpaceDetailViewModel {
  id: string;
  title: string;
  description: string;
  template: string;
  templateLabel: string;
  fileCount: number;
  subspaceCount: number;
  updatedText: string;
  files: SpaceDetailFileViewModel[];
  subspaces: SpaceDetailSubspaceViewModel[];
  hasTemplateComponent: boolean;
}

const TEMPLATE_NAMES: Record<string, string> = {
  gallery: '画廊',
  product: '商品',
  portfolio: '作品集',
  document: '文档',
  collection: '合集',
  custom: '自定义',
};

function asRecord(value: unknown): UnknownRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function resolveImageFlag(mimeType: string, url: string): boolean {
  return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);
}

function resolveVideoFlag(mimeType: string, url: string): boolean {
  return mimeType.startsWith('video/') || /\.(mp4|mov|avi|m4v|webm)$/i.test(url);
}

function normalizeFile(raw: unknown): SpaceDetailFileViewModel {
  const record = asRecord(raw);
  const url = pickFirstString([record.url]);
  const mimeType = pickFirstString([record.mimeType, record.mime_type]);
  return {
    id: pickFirstString([record.id], url),
    name: pickFirstString([record.name], '未命名文件'),
    url,
    mimeType,
    section: pickFirstString([record.section]),
    isImage: resolveImageFlag(mimeType, url),
    isVideo: resolveVideoFlag(mimeType, url),
  };
}

function normalizeSubspace(raw: unknown): SpaceDetailSubspaceViewModel {
  const record = asRecord(raw);
  return {
    id: pickFirstString([record.id]),
    name: pickFirstString([record.name], '未命名子空间'),
    fileCount: toFiniteNumber(record.fileCount ?? record.file_count),
    coverUrl: pickFirstString([record.coverUrl, record.cover_url]),
  };
}

export function buildSpaceDetailViewModel(space: unknown): SpaceDetailViewModel {
  const record = asRecord(space);
  const template = pickFirstString([record.template], 'gallery');
  const files = asArray(record.files).map(normalizeFile).filter((item) => item.url);
  const subspaces = asArray(record.subspaces).map(normalizeSubspace);
  const updatedAt = toFiniteNumber(record.updatedAt ?? record.updated_at);

  return {
    id: pickFirstString([record.id]),
    title: pickFirstString([record.name], '资源详情'),
    description: pickFirstString([record.description]),
    template,
    templateLabel: TEMPLATE_NAMES[template] || template,
    fileCount: files.length || toFiniteNumber(record.fileCount ?? record.file_count),
    subspaceCount: subspaces.length,
    updatedText: updatedAt ? formatDateTime(updatedAt) : '',
    files,
    subspaces,
    hasTemplateComponent: ['gallery', 'product', 'portfolio', 'document', 'collection'].includes(template),
  };
}

export function buildSpacePreviewUrls(space: unknown): string[] {
  return buildSpaceDetailViewModel(space).files
    .filter((item) => item.isImage)
    .map((item) => item.url);
}
