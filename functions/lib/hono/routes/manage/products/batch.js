import { Hono } from 'hono';
import { CommandIdempotencyRepository } from '../../../../../repositories/CommandIdempotencyRepository.js';
import {
    ProductCatalogService,
    buildVariantMatchKey,
    mergeIncomingWithExisting,
} from '../../../../../services/ProductCatalogService.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { BadRequestError } from '../../../errors.js';
import { scheduleProductCacheInvalidation } from './cache-helpers.js';
import {
    cleanupReservedCommand,
    parseStoredResponse,
    replayReservedCommand,
    resolveReservationOwnership,
} from '../../../../../services/order-procurement-shared.js';

const app = new Hono();
const PRODUCT_BATCH_IMPORT_COMMAND_TYPE = 'product_batch_import';
export const auditRouteDeclarations = declareAuditRoutes([
    { method: 'POST', path: '/', domain: 'products', action: 'product.batch_import', severity: 'high', targetType: 'product' },
]);

function getIdempotencyKey(c) {
    const requestKey = String(c.req.header('Idempotency-Key') || '').trim();
    return requestKey || crypto.randomUUID();
}

function normalizeBatchImportFingerprintValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeBatchImportFingerprintValue(item));
    }

    if (value && typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                const normalized = normalizeBatchImportFingerprintValue(value[key]);
                if (normalized !== undefined) {
                    acc[key] = normalized;
                }
                return acc;
            }, {});
    }

    return value;
}

function buildBatchImportRequestFingerprint(body = {}) {
    return JSON.stringify(normalizeBatchImportFingerprintValue(body));
}

function getBatchCommandScopeKey(c) {
    const actorId = String(c.get('user')?.id || 'anonymous').trim() || 'anonymous';
    return `${PRODUCT_BATCH_IMPORT_COMMAND_TYPE}:${actorId}`;
}

function isDuplicateOutboxIdempotencyError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return (
        message.includes('unique constraint failed')
        && (
            message.includes('domain_outbox.idempotency_key')
            || message.includes('idx_domain_outbox_idempotency_key')
        )
    );
}

async function publishBatchImportCacheEvent(c, result, { commandId, correlationId } = {}) {
    if (!result?.success) return;
    try {
        await scheduleProductCacheInvalidation(c, {
            eventType: 'product_batch_imported',
            productIds: Array.isArray(result?.productIds) ? result.productIds : [],
        }, {
            commandId,
            correlationId,
        });
    } catch (error) {
        if (!isDuplicateOutboxIdempotencyError(error)) {
            throw error;
        }
    }
}

async function reserveBatchImportCommand(c, { requestFingerprint }) {
    const commandIdempotencyRepo = new CommandIdempotencyRepository(c.env.DB);
    const idempotencyKey = getIdempotencyKey(c);
    const reservation = await commandIdempotencyRepo.reserveCommand(
        PRODUCT_BATCH_IMPORT_COMMAND_TYPE,
        getBatchCommandScopeKey(c),
        idempotencyKey,
        requestFingerprint
    );

    if (reservation?.existing) {
        if (reservation.record?.request_fingerprint !== requestFingerprint) {
            throw new BadRequestError('同一个幂等键不能提交不同的批量导入请求');
        }

        const storedResponse = parseStoredResponse(reservation.record?.response_json);
        if (reservation.record?.status === 'failed' && storedResponse) {
            return {
                replay: null,
                resume: storedResponse,
                reservation,
                commandIdempotencyRepo,
            };
        }

        return {
            replay: replayReservedCommand(reservation, requestFingerprint, {
                mismatchMessage: '同一个幂等键不能提交不同的批量导入请求',
                inFlightMessage: '当前幂等键对应的批量导入命令仍在处理中',
            }),
            resume: null,
            reservation,
            commandIdempotencyRepo,
        };
    }

    return {
        replay: null,
        resume: null,
        reservation,
        commandIdempotencyRepo,
    };
}

/**
 * POST /api/manage/products/batch
 * 批量导入商品
 */
app.post('/', async (c) => {
    const service = new ProductCatalogService(c.env.DB);
    const body = await c.req.json();
    const requestFingerprint = buildBatchImportRequestFingerprint(body);
    const {
        replay,
        resume,
        reservation,
        commandIdempotencyRepo,
    } = await reserveBatchImportCommand(c, { requestFingerprint });

    if (replay) {
        return c.json(replay);
    }

    if (resume) {
        await publishBatchImportCacheEvent(c, resume, {
            commandId: reservation.record?.command_id,
            correlationId: reservation.record?.command_id,
        });
        await commandIdempotencyRepo
            .buildFinalizeStatement(reservation.record?.command_id, resume)
            .run();
        return c.json(resume);
    }

    const ownsReservation = resolveReservationOwnership(reservation);
    let result = null;

    try {
        result = await service.batchImport(c, body, {
            skipCacheInvalidation: true,
        });
        await publishBatchImportCacheEvent(c, result, {
            commandId: reservation.record?.command_id,
            correlationId: reservation.record?.command_id,
        });
        await commandIdempotencyRepo
            .buildFinalizeStatement(reservation.record?.command_id, result)
            .run();
    } catch (error) {
        if (result) {
            try {
                await commandIdempotencyRepo
                    .buildFinalizeStatement(reservation.record?.command_id, result, 'failed')
                    .run();
            } catch (finalizeError) {
                console.error('Product batch-import idempotency finalize failed:', finalizeError);
            }
        } else {
            await cleanupReservedCommand({
                commandIdempotencyRepo,
                db: c.env.DB,
                ownsReservation,
                commandId: reservation.record?.command_id,
            });
        }
        throw error;
    }

    const summary = result?.summary || {};
    scheduleAuditEvent(c, {
        domain: 'products',
        action: 'product.batch_import',
        result: result?.success ? 'success' : 'failure',
        severity: 'high',
        targetType: 'product',
        summary: 'Batch imported products',
        metadata: {
            imported: result?.count ?? 0,
            created: summary.createdProducts ?? 0,
            updated: summary.updatedProducts ?? 0,
            failed: summary.failedProducts ?? 0,
            conflicts: summary.conflicts ?? 0,
        },
    });
    return c.json(result);
});

export { buildVariantMatchKey, mergeIncomingWithExisting };
export default app;
