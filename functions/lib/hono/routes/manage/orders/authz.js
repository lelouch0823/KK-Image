import { checkPermission } from '../../../middleware/auth.js';
import { ForbiddenError } from '../../../errors.js';
import { MSG } from '../../../_shared/utils.js';

export async function hasRoutePermission(c, user, permission) {
  return checkPermission(c, user, permission);
}

export async function assertRoutePermission(c, user, permission) {
  const allowed = await hasRoutePermission(c, user, permission);
  if (!allowed) {
    throw new ForbiddenError(MSG.AUTH.PERMISSION_DENIED);
  }
}
