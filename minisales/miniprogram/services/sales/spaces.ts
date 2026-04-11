import {
    salesRequest,
    type SalesRequestOptions,
    type SalesRequestResult,
} from '../http/request';
import { SALES_API } from '../../utils/constants';
import {
    pickFirstString,
    resolveFilePath,
    safeParseArray,
    safeParseObject,
    toFiniteNumber,
} from '../../utils/helpers';

type RequestFn = <T>(options: SalesRequestOptions) => Promise<SalesRequestResult<T>>;
type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as UnknownRecord;
    }
    return {};
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function withData<T, U>(result: SalesRequestResult<T>, data: U | null): SalesRequestResult<U> {
    return {
        ...result,
        data,
    };
}

function normalizeSpaceFile(raw: unknown) {
    const record = asRecord(raw);
    return {
        id: pickFirstString([record.id]),
        name: pickFirstString([record.name], '未命名文件'),
        url: resolveFilePath(record.url ?? record.file_url, record.storage_key ?? record.storageKey),
        mimeType: pickFirstString([record.mimeType, record.mime_type]),
        section: pickFirstString([record.section]),
        width: toFiniteNumber(record.width),
        height: toFiniteNumber(record.height),
    };
}

function normalizeSalesSpace(raw: unknown) {
    const record = asRecord(raw);
    const templateData = safeParseObject(record.template_data ?? record.templateData, {});
    const rawFiles = asArray(record.files).map(normalizeSpaceFile);
    const templateImages = safeParseArray<string>((templateData as UnknownRecord).images, [])
        .map((image, index) => ({
            id: `template-image-${index}`,
            name: `商品图片 ${index + 1}`,
            url: resolveFilePath(image),
            mimeType: 'image/jpeg',
            section: '',
            width: 0,
            height: 0,
        }))
        .filter((file) => file.url);
    const mergedFiles = [
        ...templateImages.filter((candidate) => !rawFiles.some((file) => file.url === candidate.url)),
        ...rawFiles,
    ];
    const resolveTemplateCover = (nextTemplateData: UnknownRecord, imagesValue: unknown) => {
        const nextTemplateImages = safeParseArray<string>(nextTemplateData.images, [])
            .map((image) => resolveFilePath(image))
            .filter(Boolean);
        if (nextTemplateImages[0]) {
            return nextTemplateImages[0];
        }

        const productImages = safeParseArray<string>(imagesValue, [])
            .map((image) => resolveFilePath(image))
            .filter(Boolean);
        return productImages[0] || '';
    };
    return {
        id: pickFirstString([record.id]),
        name: pickFirstString([record.name], '未命名空间'),
        description: pickFirstString([record.description]),
        template: pickFirstString([record.template], 'gallery'),
        templateData,
        fileCount: mergedFiles.length || toFiniteNumber(record.file_count ?? record.fileCount),
        coverUrl: resolveFilePath(
            record.coverUrl ?? record.cover_url,
            record.cover_storage_key ?? record.coverStorageKey
        ),
        shareToken: pickFirstString([record.share_token, record.shareToken]),
        updatedAt: toFiniteNumber(record.updated_at ?? record.updatedAt),
        productId: pickFirstString([record.product_id, record.productId]),
        variantId: pickFirstString([record.variant_id, record.variantId]),
        files: mergedFiles,
        subspaces: asArray(record.subspaces).map((item) => {
            const subspace = asRecord(item);
            const subspaceTemplateData = safeParseObject(
                subspace.template_data ?? subspace.templateData,
                {}
            );
            const subspaceTemplateImages = safeParseArray<string>(subspaceTemplateData.images, [])
                .map((image) => resolveFilePath(image))
                .filter(Boolean);
            const coverUrl = resolveFilePath(
                subspace.coverUrl ?? subspace.cover_url,
                subspace.cover_storage_key ?? subspace.coverStorageKey
            ) || resolveTemplateCover(subspaceTemplateData, subspace.p_images ?? subspace.productImages);
            return {
                id: pickFirstString([subspace.id]),
                name: pickFirstString([subspace.name], '未命名子空间'),
                fileCount: toFiniteNumber(subspace.file_count ?? subspace.fileCount) || subspaceTemplateImages.length,
                coverUrl,
            };
        }),
    };
}

export async function loadSalesSpaces(
    input: { accessToken: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<ReturnType<typeof normalizeSalesSpace>[]>> {
    const result = await request<unknown[]>({
        path: SALES_API.spaces(input.accessToken),
        method: 'GET',
    });

    if (!result.success) {
        return withData(result, null);
    }

    return withData(result, Array.isArray(result.data) ? result.data.map(normalizeSalesSpace) : []);
}

export async function getSalesSpaceDetail(
    input: { accessToken: string; spaceId: string },
    request: RequestFn = salesRequest
): Promise<SalesRequestResult<ReturnType<typeof normalizeSalesSpace>>> {
    const result = await request<unknown>({
        path: SALES_API.spaceById(input.accessToken, input.spaceId),
        method: 'GET',
    });

    if (!result.success || !result.data) {
        return withData(result, null);
    }

    return withData(result, normalizeSalesSpace(result.data));
}
