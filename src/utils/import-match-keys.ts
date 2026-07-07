const PRODUCT_CODE_ALIASES = ['product code', '商品编码', '产品编码'];
const VARIANT_CODE_ALIASES = ['variant code', '变体编码'];

const findHeaderIndex = (headers: string[], aliases: string[]): number => {
    return headers.findIndex((header) => {
        const normalized = String(header || '').trim().toLowerCase();
        return aliases.some((alias) => normalized === alias || normalized.includes(alias));
    });
};

export const extractInternalCodes = (headers: string[], row: unknown[]): { product_code?: string; variant_code?: string } => {
    const productCodeIndex = findHeaderIndex(headers, PRODUCT_CODE_ALIASES);
    const variantCodeIndex = findHeaderIndex(headers, VARIANT_CODE_ALIASES);

    const product_code = productCodeIndex >= 0 ? row[productCodeIndex] : undefined;
    const variant_code = variantCodeIndex >= 0 ? row[variantCodeIndex] : undefined;

    return {
        product_code: product_code ? String(product_code).trim() : undefined,
        variant_code: variant_code ? String(variant_code).trim() : undefined,
    };
};

interface MatchKeyItem {
    variant_code?: string;
    product_code?: string;
    spu?: string;
    name?: string;
}

export const getItemMatchKey = (item: MatchKeyItem): string => {
    return item.variant_code || item.product_code || item.spu || item.name || '';
};
