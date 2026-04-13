function toTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildOutboxOpsMetrics(events = [], filters = {}, options = {}) {
  let failedJobs = 0;
  let activeJobs = 0;
  let latestCreatedAt = null;
  let latestTimestamp = null;

  for (const event of events) {
    const jobs = Array.isArray(event?.consumerJobs) ? event.consumerJobs : [];

    for (const job of jobs) {
      if (job?.status === 'failed') failedJobs += 1;
      if (job?.status === 'pending' || job?.status === 'processing') activeJobs += 1;
    }

    const timestamp = toTimestamp(event?.created_at);
    if (timestamp !== null && (latestTimestamp === null || timestamp > latestTimestamp)) {
      latestTimestamp = timestamp;
      latestCreatedAt = event.created_at;
    }
  }

  const selectedFilters = [
    filters?.eventType,
    filters?.consumerName,
    filters?.status,
  ].filter(Boolean);

  return {
    totalEvents: events.length,
    failedJobs,
    activeJobs,
    latestCreatedAt,
    selectedFilters,
    hasFilters: selectedFilters.length > 0,
    isLoading: Boolean(options.isLoading),
    isStale: Boolean(options.isStale),
  };
}
