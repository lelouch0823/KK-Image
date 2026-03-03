export function toPositiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  const int = Math.floor(num);
  return int > 0 ? int : fallback;
}

export function parseRepoPagination(input = {}, options = {}) {
  const defaultPage = toPositiveInt(options.defaultPage, 1);
  const defaultLimit = toPositiveInt(options.defaultLimit, 20);
  const maxLimit = toPositiveInt(options.maxLimit, 100);

  const page = toPositiveInt(input.page, defaultPage);
  const limit = Math.min(maxLimit, Math.max(1, toPositiveInt(input.limit, defaultLimit)));

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}
