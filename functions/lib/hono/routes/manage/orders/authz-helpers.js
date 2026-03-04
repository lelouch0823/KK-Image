import { MSG } from '../../../_shared/utils.js';
import { BadRequestError, ForbiddenError } from '../../../errors.js';
import { checkPermission } from '../../../middleware/auth.js';

export async function assertAdminFull(c, user) {
  const allowed = await checkPermission(c, user, 'admin:full');
  if (!allowed) {
    throw new ForbiddenError(MSG.AUTH.PERMISSION_DENIED);
  }
}

export async function assertForceStatusTransitionAllowed(c, user, reason) {
  await assertAdminFull(c, user);
  if (!String(reason || '').trim()) {
    throw new BadRequestError('Reason is required for forced status transition');
  }
}
