import { buildAuthzInput, evaluatePermission } from '../../../../authz/index.js';
import { ForbiddenError } from '../../../errors.js';
import { MSG } from '../../../_shared/utils.js';

export async function hasRoutePermission(c, user, permission) {
  const authzInput = buildAuthzInput({
    user,
    permission,
    path: c.req.path,
    method: c.req.method,
  });

  return evaluatePermission({ input: authzInput });
}

export async function assertRoutePermission(c, user, permission) {
  const allowed = await hasRoutePermission(c, user, permission);
  if (!allowed) {
    throw new ForbiddenError(MSG.AUTH.PERMISSION_DENIED);
  }
}
