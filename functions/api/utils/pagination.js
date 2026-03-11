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

  const parseOrDefault = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : fallback;
  };

  const page = Math.max(1, parseOrDefault(input.page, defaultPage));
  const limit = Math.min(maxLimit, Math.max(1, parseOrDefault(input.limit, defaultLimit)));

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

export function normalizeListQuery(query = {}, options = {}) {
  const allowedKeys = Array.isArray(options.allowedKeys) ? options.allowedKeys : [];
  const defaults = options.defaults || {};
  const maxLimit = toPositiveInt(options.maxLimit, 100);
  const normalized = {};
  const coercePaginationInput = (value) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return value;
  };

  const { page, limit } = parseRepoPagination(
    {
      page: coercePaginationInput(query?.page),
      limit: coercePaginationInput(query?.limit),
    },
    {
      defaultPage: defaults.page,
      defaultLimit: defaults.limit,
      maxLimit,
    }
  );

  normalized.page = String(page);
  normalized.limit = String(limit);

  for (const key of allowedKeys) {
    if (key === 'page' || key === 'limit') continue;
    const value = query?.[key];
    if (value === undefined || value === null || value === '') continue;
    normalized[key] = String(value);
  }

  return Object.fromEntries(
    Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))
  );
}
