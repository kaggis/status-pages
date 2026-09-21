import type {
  LatestMetricData,
  LatestMetricDataResponse,
} from '@/types/latestProblems'

export type ProblemSeverity = 'critical' | 'warning' | 'unknown' | 'missing'

// Ordered by severity (most severe first)
export const PROBLEM_SEVERITIES: ProblemSeverity[] = [
  'critical',
  'warning',
  'unknown',
  'missing',
]

/** Returns the severity of a check status, or null if it is not a problem (OK, DOWNTIME, ...) */
export const getProblemSeverity = (status: string): ProblemSeverity | null => {
  switch (status?.toUpperCase()) {
    case 'CRITICAL':
      return 'critical'
    case 'WARNING':
      return 'warning'
    case 'UNKNOWN':
      return 'unknown'
    case 'MISSING':
      return 'missing'
    default:
      return null
  }
}

const toTime = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

const severityRank = (status: string) => {
  const s = getProblemSeverity(status)
  return s === null ? PROBLEM_SEVERITIES.length : PROBLEM_SEVERITIES.indexOf(s)
}

/** Keeps only problematic checks, newest first (ties broken by severity). */
export const selectLatestProblems = (
  response: LatestMetricDataResponse,
): LatestMetricData[] =>
  (response?.data?.metric_data ?? [])
    .filter((m) => getProblemSeverity(m.status) !== null)
    .sort(
      (a, b) =>
        toTime(b.timestamp) - toTime(a.timestamp) ||
        severityRank(a.status) - severityRank(b.status),
    )

export const formatRelativeTime = (iso: string, now: number): string => {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const seconds = Math.max(0, Math.round((now - t) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * Deep link to the status timeline page for a single metric, e.g.
 * /tenants/{id}/status?report=CORE&group=CLOUD-C&serviceType=webportal
 *   &endpoint=host1.cloudc.foo_ID3&metric=generic.http.connect&ts=2026-09-21T09%3A12%3A00Z
 *
 * `ts` is the check's own timestamp so the timeline can focus on that result.
 * If the status page expects the start of the day instead, use:
 *   `${check.timestamp.slice(0, 10)}T00:00:00Z`
 */
export const buildStatusTimelineHref = (
  basePath: string,
  report: string,
  check: LatestMetricData,
): string => {
  const params = new URLSearchParams({
    report,
    group: check.endpoint_group,
    serviceType: check.service,
    endpoint: check.endpoint,
    metric: check.metric,
  })
  if (check.timestamp) params.set('ts', check.timestamp)
  return `${basePath}?${params.toString()}`
}
