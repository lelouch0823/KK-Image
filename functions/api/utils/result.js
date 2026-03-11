export function getChangesCount(result) {
  return Number(result?.meta?.changes || 0);
}

export function hasChanges(result) {
  return getChangesCount(result) > 0;
}
