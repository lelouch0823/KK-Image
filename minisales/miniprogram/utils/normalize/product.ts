import {
    pickFirstString,
    resolveFilePath,
    safeParseArray,
    safeParseObject,
    toFiniteNumber,
} from '../helpers';

type UnknownRecord = Record<string, unknown>;

export type VariantSelectPolicy = 'in_stock_only' | 'allow_out_of_stock' | 'all';

export interface NormalizedSalesProductSummary {
    id: string;
    name: string;
    brand: string;
    series: string;
    spu: string;
    images: unknown[];
    primaryImage: string;
}

export interface NormalizedSalesProductVariant {
    id: string;
    sku: string;
    status: string;
    optionsValues: Record<string, string>;
    displayName: string;
    availableQuantity: number;
    replenishmentQuantity: number;
    replenishmentPoCount: number;
    primaryImage: string;
    images: unknown[];
}

export interface NormalizedSalesProductDetail extends NormalizedSalesProductSummary {
    dimensionMap: Record<string, string>;
    dimensions: Array<Record<string, unknown>>;
    variants: NormalizedSalesProductVariant[];
}

function asRecord(value: unknown): UnknownRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as UnknownRecord;
    }
    return {};
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function normalizeOptionValues(value: unknown): Record<string, string> {
    const record = safeParseObject(value, {});
    return Object.entries(record).reduce<Record<string, string>>((acc, [key, raw]) => {
        const normalizedKey = String(key || '').trim();
        const normalizedValue = String(raw ?? '').trim();
        if (normalizedKey && normalizedValue) {
            acc[normalizedKey] = normalizedValue;
        }
        return acc;
    }, {});
}

function resolvePrimaryImage(raw: UnknownRecord, fallbackImages: unknown[] = []): string {
    const firstImage = asRecord(fallbackImages[0]);
    return pickFirstString([
        raw.primaryImage,
        raw.primary_image,
        firstImage.url,
        firstImage.image_id,
        firstImage.storage_key,
    ]) || resolveFilePath(undefined, raw.image_id);
}

function toVariantDisplayName(optionsValues: Record<string, string>): string {
    const parts = Object.values(optionsValues).filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : '-';
}

export function normalizeSalesProductSummary(raw: unknown): NormalizedSalesProductSummary {
    const record = asRecord(raw);
    const images = safeParseArray<unknown>(record.images, []);
    return {
        id: pickFirstString([record.id]),
        name: pickFirstString([record.name], '未命名商品'),
        brand: pickFirstString([record.brand]),
        series: pickFirstString([record.series]),
        spu: pickFirstString([record.spu]),
        images,
        primaryImage: resolvePrimaryImage(record, images),
    };
}

export function normalizeSalesProductVariant(raw: unknown): NormalizedSalesProductVariant {
    const record = asRecord(raw);
    const images = safeParseArray<unknown>(record.images, []);
    const optionsValues = normalizeOptionValues(record.options_values ?? record.optionsValues);
    return {
        id: pickFirstString([record.id]),
        sku: pickFirstString([record.sku]),
        status: pickFirstString([record.status], 'active'),
        optionsValues,
        displayName: toVariantDisplayName(optionsValues),
        availableQuantity: toFiniteNumber(
            record.available_quantity ?? record.available ?? record.stock_quantity ?? record.stockQuantity
        ),
        replenishmentQuantity: toFiniteNumber(record.replenishment_quantity ?? record.replenishmentQuantity),
        replenishmentPoCount: toFiniteNumber(record.replenishment_po_count ?? record.replenishmentPoCount),
        primaryImage: resolvePrimaryImage(record, images),
        images,
    };
}

export function isSelectableSalesVariant(
    variant: NormalizedSalesProductVariant,
    policy: VariantSelectPolicy = 'in_stock_only'
): boolean {
    const status = String(variant.status || '').toLowerCase();
    if (policy === 'all') {
        return true;
    }
    if (status === 'archived') {
        return false;
    }
    if (policy === 'allow_out_of_stock') {
        return true;
    }
    return variant.availableQuantity > 0;
}

export function pickSelectableProductVariants(
    variants: NormalizedSalesProductVariant[],
    policy: VariantSelectPolicy = 'in_stock_only'
): NormalizedSalesProductVariant[] {
    return (variants || []).filter((variant) => isSelectableSalesVariant(variant, policy));
}

export function normalizeSalesProductDetail(raw: unknown): NormalizedSalesProductDetail {
    const record = asRecord(raw);
    const summary = normalizeSalesProductSummary(record);
    return {
        ...summary,
        dimensionMap: safeParseObject(record.dimension_map ?? record.dimensionMap, {}),
        dimensions: asArray(record.dimensions).map((dimension) => asRecord(dimension)),
        variants: asArray(record.variants).map(normalizeSalesProductVariant),
    };
}
