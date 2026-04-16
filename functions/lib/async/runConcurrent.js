function normalizeConcurrency(value, itemCount) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return Math.min(Math.max(itemCount, 1), 1);
  }
  return Math.min(parsed, Math.max(itemCount, 1));
}

export async function runConcurrent(items = [], worker, concurrency = 1) {
  const normalizedItems = Array.isArray(items) ? items : [];
  if (normalizedItems.length === 0) return [];

  const limit = normalizeConcurrency(concurrency, normalizedItems.length);
  const results = new Array(normalizedItems.length);
  let nextIndex = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (nextIndex < normalizedItems.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(normalizedItems[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
}
