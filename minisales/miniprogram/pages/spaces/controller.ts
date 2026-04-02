import { formatDateTime, pickFirstString, toFiniteNumber } from '../../utils/helpers';

type UnknownRecord = Record<string, unknown>;

export interface SpaceCardViewModel {
  id: string;
  title: string;
  description: string;
  template: string;
  templateLabel: string;
  coverUrl: string;
  fileCount: number;
  updatedText: string;
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

export function buildSpacesGridModel(spaces: unknown[]): SpaceCardViewModel[] {
  return (Array.isArray(spaces) ? spaces : []).map((space) => {
    const record = asRecord(space);
    const template = pickFirstString([record.template], 'gallery');
    const updatedAt = toFiniteNumber(record.updatedAt ?? record.updated_at);
    return {
      id: pickFirstString([record.id]),
      title: pickFirstString([record.name], '未命名空间'),
      description: pickFirstString([record.description]),
      template,
      templateLabel: TEMPLATE_NAMES[template] || template,
      coverUrl: pickFirstString([record.coverUrl, record.cover_url]),
      fileCount: toFiniteNumber(record.fileCount ?? record.file_count),
      updatedText: updatedAt ? formatDateTime(updatedAt) : '',
    };
  });
}
