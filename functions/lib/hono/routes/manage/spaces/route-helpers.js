import { MSG } from '../../../../../_shared/utils.js';
import { NotFoundError } from '../../../errors.js';
import { requireEntity } from '../../../_shared/route-helpers.js';

export async function requireSpace(repo, spaceId) {
  return requireEntity(repo.findById(spaceId), () => new NotFoundError(MSG.SPACE.NOT_FOUND));
}

export function normalizeSpaceCreateFields(name, description) {
  return {
    name: name.trim(),
    description: description.trim(),
  };
}

export function buildSpaceInvalidatePayload({
  spaceId,
  space = null,
  parentId = space?.parent_id || null,
  productIds = [space?.product_id || null],
} = {}) {
  return {
    spaceId,
    parentId,
    productIds,
  };
}
