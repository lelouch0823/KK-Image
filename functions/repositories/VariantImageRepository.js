import { generateId, now } from '../api/utils/id.js';
import { executeBatchChunks } from '../lib/db/batch.js';
import { ProductVariantRepository } from './ProductVariantRepository.js';

const isVariantImageLinkConflictError = (error) => {
    const message = String(error?.message || error || '').toLowerCase();
    return (
        message.includes('unique constraint failed')
        && message.includes('variant_images.variant_id')
        && message.includes('variant_images.image_id')
    );
};

export class VariantImageRepository {
    constructor(db, productVariantRepository = null) {
        this.db = db;
        this.productVariantRepository = productVariantRepository || new ProductVariantRepository(db);
    }

    async findVariantImage(variantId, imageId) {
        return await this.db
            .prepare('SELECT * FROM variant_images WHERE variant_id = ? AND image_id = ?')
            .bind(variantId, imageId)
            .first();
    }

    async addImage({ productId, variantId, imageId, isPrimary = false }) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);

        const existingImage = await this.findVariantImage(variantId, imageId);
        if (existingImage) {
            throw new Error('Image already linked to variant');
        }

        const timestamp = now();
        const sortRow = await this.db
            .prepare('SELECT MAX(sort_order) as max_sort_order FROM variant_images WHERE variant_id = ?')
            .bind(variantId)
            .first();
        const sortOrder = Number(sortRow?.max_sort_order ?? -1) + 1;
        const id = generateId();

        const insertStatement = this.db
            .prepare(
                `INSERT INTO variant_images (id, variant_id, image_id, sort_order, is_primary, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(id, variantId, imageId, sortOrder, isPrimary ? 1 : 0, timestamp, timestamp);

        try {
            if (isPrimary) {
                await executeBatchChunks(this.db, [
                    this.db
                        .prepare('UPDATE variant_images SET is_primary = 0, updated_at = ? WHERE variant_id = ?')
                        .bind(timestamp, variantId),
                    insertStatement,
                ]);
            } else {
                await insertStatement.run();
            }
        } catch (error) {
            if (isVariantImageLinkConflictError(error)) {
                throw new Error('Image already linked to variant');
            }
            throw error;
        }

        return await this.db
            .prepare('SELECT * FROM variant_images WHERE id = ?')
            .bind(id)
            .first();
    }

    normalizeIncomingImages(images = []) {
        const normalized = [];
        const seen = new Set();
        let primaryIndex = -1;

        for (const item of images) {
            const rawImageId = typeof item === 'string'
                ? item
                : item?.image_id ?? item?.id;
            const imageId = String(rawImageId ?? '').trim();
            if (!imageId || seen.has(imageId)) continue;
            seen.add(imageId);

            const isPrimaryFlag = typeof item === 'object' && item !== null
                ? Number(item.is_primary) === 1 || item.is_primary === true
                : false;

            if (isPrimaryFlag && primaryIndex === -1) {
                primaryIndex = normalized.length;
            }

            normalized.push({
                image_id: imageId,
                sort_order: normalized.length,
                is_primary: 0,
            });
        }

        if (normalized.length > 0) {
            const finalPrimaryIndex = primaryIndex === -1 ? 0 : primaryIndex;
            normalized[finalPrimaryIndex].is_primary = 1;
        }

        return normalized;
    }

    async syncImages(productId, variantId, images = []) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);
        const timestamp = now();
        const normalizedImages = this.normalizeIncomingImages(images);
        const statements = [];

        statements.push(
            this.db.prepare('DELETE FROM variant_images WHERE variant_id = ?').bind(variantId)
        );

        normalizedImages.forEach((image) => {
            const id = generateId();
            statements.push(
                this.db.prepare(
                    `INSERT INTO variant_images (id, variant_id, image_id, sort_order, is_primary, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    id, variantId, image.image_id, image.sort_order, image.is_primary, timestamp, timestamp
                )
            );
        });

        if (statements.length > 0) {
            await executeBatchChunks(this.db, statements);
        }
    }

    async setPrimary({ productId, variantId, imageId }) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);
        const existingImage = await this.db
            .prepare('SELECT 1 FROM variant_images WHERE variant_id = ? AND image_id = ?')
            .bind(variantId, imageId)
            .first();

        if (!existingImage) {
            throw new Error('Variant image does not exist');
        }

        const timestamp = now();

        const statements = [
            this.db
                .prepare('UPDATE variant_images SET is_primary = 0, updated_at = ? WHERE variant_id = ?')
                .bind(timestamp, variantId),
            this.db
                .prepare(
                    `UPDATE variant_images
                     SET is_primary = 1, updated_at = ?
                     WHERE variant_id = ? AND image_id = ?`
                )
                .bind(timestamp, variantId, imageId),
        ];

        await executeBatchChunks(this.db, statements);
    }

    async sortImages({ productId, variantId, imageIds }) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);
        const { results } = await this.db
            .prepare('SELECT image_id FROM variant_images WHERE variant_id = ?')
            .bind(variantId)
            .all();
        const currentImageIds = (results || []).map((row) => row.image_id);
        const requestedImageIds = imageIds.map((imageId) => String(imageId));
        const requestedImageSet = new Set(requestedImageIds);
        const isCompleteUniqueMatch = (
            requestedImageIds.length === currentImageIds.length
            && requestedImageSet.size === requestedImageIds.length
            && currentImageIds.every((imageId) => requestedImageSet.has(imageId))
        );

        if (!isCompleteUniqueMatch) {
            throw new Error('imageIds must include each variant image exactly once');
        }

        const timestamp = now();
        const sortRow = await this.db
            .prepare('SELECT MAX(sort_order) as max_sort_order FROM variant_images WHERE variant_id = ?')
            .bind(variantId)
            .first();
        const tempBase = Number(sortRow?.max_sort_order ?? -1) + imageIds.length + 1;

        const statements = imageIds.map((imageId, index) =>
            this.db
                .prepare(
                    `UPDATE variant_images
                     SET sort_order = ?, updated_at = ?
                     WHERE variant_id = ? AND image_id = ?`
                )
                .bind(tempBase + index, timestamp, variantId, imageId)
        );

        statements.push(...imageIds.map((imageId, index) =>
            this.db
                .prepare(
                    `UPDATE variant_images
                     SET sort_order = ?, updated_at = ?
                     WHERE variant_id = ? AND image_id = ?`
                )
                .bind(index, timestamp, variantId, imageId)
        ));
        await executeBatchChunks(this.db, statements);
    }

    async deleteImage({ productId, variantId, imageId }) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);
        const currentImage = await this.findVariantImage(variantId, imageId);
        if (!currentImage) {
            return false;
        }

        const timestamp = now();
        const deleteStatement = this.db
            .prepare('DELETE FROM variant_images WHERE variant_id = ? AND image_id = ?')
            .bind(variantId, imageId);

        if (Number(currentImage.is_primary) !== 1) {
            const result = await deleteStatement.run();
            return (result?.meta?.changes || 0) > 0;
        }

        const nextImage = await this.db
            .prepare(
                `SELECT image_id
                 FROM variant_images
                 WHERE variant_id = ? AND image_id <> ?
                 ORDER BY sort_order ASC, created_at ASC
                 LIMIT 1`
            )
            .bind(variantId, imageId)
            .first();

        const statements = [deleteStatement];
        if (nextImage?.image_id) {
            statements.push(
                this.db
                    .prepare(
                        `UPDATE variant_images
                         SET is_primary = 1, updated_at = ?
                         WHERE variant_id = ? AND image_id = ?`
                    )
                    .bind(timestamp, variantId, nextImage.image_id)
            );
        }

        await executeBatchChunks(this.db, statements);
        return true;
    }

    async listByVariant({ productId, variantId }) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);
        const { results } = await this.db
            .prepare(
                `SELECT * FROM variant_images
                 WHERE variant_id = ?
                 ORDER BY is_primary DESC, sort_order ASC, created_at ASC`
            )
            .bind(variantId)
            .all();
        return results || [];
    }
}
