import { generateId, now } from '../api/utils/id.js';
import { ProductVariantRepository } from './ProductVariantRepository.js';

export class VariantImageRepository {
    constructor(db, productVariantRepository = null) {
        this.db = db;
        this.productVariantRepository = productVariantRepository || new ProductVariantRepository(db);
    }

    async addImage({ productId, variantId, imageId, isPrimary = false }) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);

        const timestamp = now();
        const sortRow = await this.db
            .prepare('SELECT MAX(sort_order) as max_sort_order FROM variant_images WHERE variant_id = ?')
            .bind(variantId)
            .first();
        const sortOrder = Number(sortRow?.max_sort_order ?? -1) + 1;
        const id = generateId();

        await this.db
            .prepare(
                `INSERT INTO variant_images (id, variant_id, image_id, sort_order, is_primary, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(id, variantId, imageId, sortOrder, isPrimary ? 1 : 0, timestamp, timestamp)
            .run();

        return await this.db
            .prepare('SELECT * FROM variant_images WHERE id = ?')
            .bind(id)
            .first();
    }

    async setPrimary({ productId, variantId, imageId }) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);
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

        await this.db.batch(statements);
    }

    async sortImages({ productId, variantId, imageIds }) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);
        const timestamp = now();
        const statements = imageIds.map((imageId, index) =>
            this.db
                .prepare(
                    `UPDATE variant_images
                     SET sort_order = ?, updated_at = ?
                     WHERE variant_id = ? AND image_id = ?`
                )
                .bind(index, timestamp, variantId, imageId)
        );
        await this.db.batch(statements);
    }

    async deleteImage({ productId, variantId, imageId }) {
        await this.productVariantRepository.assertBelongsToProduct(variantId, productId);
        const result = await this.db
            .prepare('DELETE FROM variant_images WHERE variant_id = ? AND image_id = ?')
            .bind(variantId, imageId)
            .run();
        return (result?.meta?.changes || 0) > 0;
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
