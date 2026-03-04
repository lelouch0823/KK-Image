import { MSG } from '../../../_shared/utils.js';
import { BadRequestError } from '../../../errors.js';
import { findUnknownPolicyActions } from '../../../../authz/index.js';

export function findUnknownPermissions(permissions = []) {
  return findUnknownPolicyActions(permissions);
}

export function formatUnknownPermissionsError(unknownPermissions = []) {
  return `${MSG.COMMON.INVALID_PARAMS}: unknown permissions ${unknownPermissions.join(', ')}`;
}

export function assertKnownPermissions(permissions) {
  if (permissions === undefined) return;

  const unknownPermissions = findUnknownPermissions(permissions);
  if (unknownPermissions.length > 0) {
    throw new BadRequestError(formatUnknownPermissionsError(unknownPermissions));
  }
}
