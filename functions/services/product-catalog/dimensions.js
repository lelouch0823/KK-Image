import { hasOwnMeta, normalizeMeta } from './batch-import.js';

const normalizeDimensionName = (name) => String(name || '').trim().toLowerCase();

export async function syncProductCatalogDimensions({
    productId,
    incomingDimensions = [],
    replaceMissing = false,
    dimensionRepo,
}) {
    if (!Array.isArray(incomingDimensions)) {
        return dimensionRepo.listByProduct(productId);
    }

    const existing = await dimensionRepo.listByProduct(productId);
    const existingById = new Map(existing.map((item) => [item.id, item]));
    const existingByName = new Map(
        existing
            .filter((item) => item?.status !== 'archived')
            .map((item) => [normalizeDimensionName(item?.name), item])
            .filter(([key]) => key)
    );
    const syncedDimensionIds = new Set();

    for (let index = 0; index < incomingDimensions.length; index += 1) {
        const incoming = incomingDimensions[index] || {};
        const name = String(incoming.name || '').trim();
        if (!name) continue;

        let dimension = null;
        const incomingId = String(incoming.id || '').trim();
        if (incomingId && existingById.has(incomingId)) {
            dimension = await dimensionRepo.updateDimension(productId, incomingId, {
                name,
                sort_order: index,
            });
        } else {
            const matchedDimension = existingByName.get(normalizeDimensionName(name));
            if (matchedDimension?.id) {
                dimension = await dimensionRepo.updateDimension(productId, matchedDimension.id, {
                    name,
                    sort_order: index,
                });
            }
        }

        if (!dimension) {
            dimension = await dimensionRepo.createDimension(productId, {
                name,
                sort_order: index,
            });
        }
        syncedDimensionIds.add(dimension.id);

        const current = existingById.get(dimension.id) || { values: [] };
        const existingValuesMap = new Map((current.values || []).map((item) => [item.value, item]));
        const incomingVals = (incoming.values || [])
            .map((value) => (typeof value === 'string' ? { value } : value))
            .filter((value) => value.value);
        const incomingValueLabels = new Set();

        for (const item of incomingVals) {
            const valueLabel = String(item.value).trim();
            if (!valueLabel) continue;
            incomingValueLabels.add(valueLabel);
            const shouldSyncMeta = hasOwnMeta(item);

            if (!existingValuesMap.has(valueLabel)) {
                const payload = { value: valueLabel };
                if (shouldSyncMeta) payload.meta = item.meta;
                const createdValue = await dimensionRepo.addValue(productId, dimension.id, payload);
                existingValuesMap.set(valueLabel, {
                    id: createdValue?.id,
                    value: valueLabel,
                    meta: shouldSyncMeta ? normalizeMeta(item.meta) : null,
                });
            } else if (shouldSyncMeta) {
                const existingRec = existingValuesMap.get(valueLabel);
                const newMetaStr = normalizeMeta(item.meta);
                const oldMetaStr = existingRec.meta || null;

                if (newMetaStr !== oldMetaStr && existingRec.id) {
                    await dimensionRepo.updateValueMeta(productId, dimension.id, existingRec.id, item.meta);
                    existingRec.meta = newMetaStr;
                }
            }
        }

        if (replaceMissing) {
            for (const existingValue of current.values || []) {
                const valueId = String(existingValue?.id || '').trim();
                const valueLabel = String(existingValue?.value || '').trim();
                if (!valueId || !valueLabel || existingValue?.status === 'archived') continue;
                if (incomingValueLabels.has(valueLabel)) continue;
                await dimensionRepo.archiveValue(productId, valueId);
            }
        }
    }

    if (replaceMissing) {
        for (const dimension of existing) {
            const dimensionId = String(dimension?.id || '').trim();
            if (!dimensionId || syncedDimensionIds.has(dimensionId) || dimension?.status === 'archived') continue;

            for (const value of dimension.values || []) {
                const valueId = String(value?.id || '').trim();
                if (!valueId || value?.status === 'archived') continue;
                await dimensionRepo.archiveValue(productId, valueId);
            }

            await dimensionRepo.archiveDimension(productId, dimensionId);
        }
    }

    return dimensionRepo.listByProduct(productId);
}
