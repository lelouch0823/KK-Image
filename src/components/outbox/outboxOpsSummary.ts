function toTimestamp(value: unknown): number | null {
  const timestamp = new Date(value as string | number | Date).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildOutboxOpsMetrics(
  events: any[] = [],
  filters: Record<string, any> = {},
  options: Record<string, any> = {}
): {
  totalEvents: number;
  failedJobs: number;
  activeJobs: number;
  latestCreatedAt: string | null;
  selectedFilters: string[];
  hasFilters: boolean;
  isLoading: boolean;
  isStale: boolean;
  refreshFailed: boolean;
} {
  let failedJobs = 0;
  let activeJobs = 0;
  let latestCreatedAt: string | null = null;
  let latestTimestamp: number | null = null;

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
    refreshFailed: Boolean(options.refreshFailed),
  };
}
