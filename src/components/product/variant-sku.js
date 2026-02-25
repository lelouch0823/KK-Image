const sanitizeFragment = (value) => String(value || '').trim().slice(0, 3).toUpperCase();

const buildSuffix = (optionsValues = {}) => {
    return Object.values(optionsValues).map(sanitizeFragment).filter(Boolean).join('-');
};

const normalizeSeed = (seed) => {
    return String(seed || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
};

export const buildVariantSku = ({ spu, optionsValues, seed }) => {
    const suffix = buildSuffix(optionsValues);
    const normalizedSpu = String(spu || '').trim();
    if (normalizedSpu) {
        return suffix ? `${normalizedSpu}-${suffix}` : normalizedSpu;
    }

    const suffixPart = suffix || 'VAR';
    const seedPart = normalizeSeed(seed) || 'AUTO';
    return `SKU-${suffixPart}-${seedPart}`;
};
