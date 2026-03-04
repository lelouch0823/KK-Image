import { MSG } from '../../../_shared/utils.js';
import { NotFoundError } from '../../../errors.js';

export async function requireSpace(repo, spaceId) {
  const space = await repo.findById(spaceId);
  if (!space) throw new NotFoundError(MSG.SPACE.NOT_FOUND);
  return space;
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
