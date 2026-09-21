import type { AccessMode, StatusItemType } from '@/types/common'
import type {
  GroupDetailResponse,
  GroupEndpointsResponse,
  GroupResultsResponse,
  GroupStatusResponse,
} from '@/types/data'
import type { LatestMetricDataResponse } from '@/types/latestProblems'

const BACKEND_API = import.meta.env.VITE_BACKEND_URI

export const fetchGroupsApi = async (
  tenantId: string,
  reportId: string,
  token: string,
): Promise<StatusItemType[]> => {
  const response = await fetch(
    `${BACKEND_API}/v1/tenants/${tenantId}/reports/${reportId}/groups`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`,
    )
  }

  return response.json()
}

export const fetchResultsGroups = async (
  tenantIdentifier: string,
  report: string | undefined,
  item: string | undefined,
  period: string | undefined,
  mode: AccessMode,
  token: string | undefined,
): Promise<GroupResultsResponse> => {
  if (mode === 'private' && !token) {
    throw new Error('Access token is required for private mode requests')
  }

  const params = new URLSearchParams()
  if (report) params.set('report', report)
  if (period) params.set('period', period)

  const query = params.toString()
  const base =
    mode === 'private'
      ? `${BACKEND_API}/v1/tenants/${tenantIdentifier}/results/groups`
      : `${BACKEND_API}/v1/public/tenants/${tenantIdentifier}/results/groups`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (mode === 'private') {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(
    `${base}${item ? `/${item}` : ''}${query ? `?${query}` : ''}`,
    { headers },
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`,
    )
  }

  return response.json()
}

export const fetchStatusGroups = async (
  tenantIdentifier: string,
  report: string,
  item: string | undefined,
  mode: AccessMode,
  token: string | undefined,
): Promise<GroupStatusResponse> => {
  if (mode === 'private' && !token) {
    throw new Error('Access token is required for private mode requests')
  }

  const base =
    mode === 'private'
      ? `${BACKEND_API}/v1/tenants/${tenantIdentifier}/status/groups`
      : `${BACKEND_API}/v1/public/tenants/${tenantIdentifier}/status/groups`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (mode === 'private') {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(
    `${base}${item ? `/${item}` : ''}?report=${report}`,
    { headers },
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`,
    )
  }

  return response.json()
}

const buildGroupResultsUrl = (
  tenantIdentifier: string,
  report: string,
  groupName: string,
  suffix: '' | '/endpoints',
  startTime: string,
  endTime: string,
  granularity: string,
  mode: AccessMode,
) => {
  const base =
    mode === 'private'
      ? `${BACKEND_API}/v1/tenants/${tenantIdentifier}/results`
      : `${BACKEND_API}/v1/public/tenants/${tenantIdentifier}/results`

  const params = new URLSearchParams({
    'start-time': startTime,
    'end-time': endTime,
  })
  if (granularity) params.set('granularity', granularity)

  return (
    `${base}/${encodeURIComponent(report)}` +
    `/groups/${encodeURIComponent(groupName)}${suffix}?${params.toString()}`
  )
}

const requestGroupResults = async <T>(
  url: string,
  mode: AccessMode,
  token: string | undefined,
): Promise<T> => {
  if (mode === 'private' && !token) {
    throw new Error('Access token is required for private mode requests')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (mode === 'private') {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`,
    )
  }

  return response.json()
}

export const fetchResultsGroupDetails = async (
  tenantIdentifier: string,
  report: string,
  groupName: string,
  startTime: string,
  endTime: string,
  granularity: string,
  mode: AccessMode,
  token: string | undefined,
): Promise<GroupDetailResponse> =>
  requestGroupResults<GroupDetailResponse>(
    buildGroupResultsUrl(
      tenantIdentifier,
      report,
      groupName,
      '',
      startTime,
      endTime,
      granularity,
      mode,
    ),
    mode,
    token,
  )

export const fetchResultsGroupEndpoints = async (
  tenantIdentifier: string,
  report: string,
  groupName: string,
  startTime: string,
  endTime: string,
  granularity: string,
  mode: AccessMode,
  token: string | undefined,
): Promise<GroupEndpointsResponse> =>
  requestGroupResults<GroupEndpointsResponse>(
    buildGroupResultsUrl(
      tenantIdentifier,
      report,
      groupName,
      '/endpoints',
      startTime,
      endTime,
      granularity,
      mode,
    ),
    mode,
    token,
  )

export interface LatestMetricDataParams {
  /** Backend status filter. `all` is the documented default. */
  filter?: string
  limit?: number
  /** Only return the latest entry per endpoint_group/host/service/metric */
  strict?: boolean
  /**
   * Scope to a single group → .../groups/{group-name}/latest-data
   * (path segment, not a query parameter). Omit for the whole report.
   */
  group?: string
}

/**
 * Private: GET /v1/tenants/{id}/report/{report-id}/groups/latest-data
 *   -> tenantIdentifier = tenant ID, report = report ID
 * Public:  ⚠️ assumed to mirror the private path under /v1/public/tenants/{tenant-name}
 *   with the report name. Confirm before enabling on the public dashboard.
 */
const buildLatestMetricDataUrl = (
  tenantIdentifier: string,
  report: string,
  mode: AccessMode,
  { filter = 'all', limit = 500, strict = true, group }: LatestMetricDataParams,
) => {
  const base =
    mode === 'private'
      ? `${BACKEND_API}/v1/tenants/${encodeURIComponent(tenantIdentifier)}`
      : `${BACKEND_API}/v1/public/tenants/${encodeURIComponent(tenantIdentifier)}`

  const params = new URLSearchParams({
    filter,
    limit: String(limit),
    strict: String(strict),
  })

  // Report-wide: /groups/latest-data · Single group: /groups/{group-name}/latest-data
  const groupSegment = group ? `/${encodeURIComponent(group)}` : ''

  return (
    `${base}/report/${encodeURIComponent(report)}` +
    `/groups${groupSegment}/latest-data?${params.toString()}`
  )
}

export const fetchLatestMetricData = async (
  tenantIdentifier: string,
  report: string,
  mode: AccessMode,
  token: string | undefined,
  params: LatestMetricDataParams = {},
): Promise<LatestMetricDataResponse> => {
  if (mode === 'private' && !token) {
    throw new Error('Access token is required for private mode requests')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (mode === 'private') {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(
    buildLatestMetricDataUrl(tenantIdentifier, report, mode, params),
    { headers },
  )

  // "Latest data not found" simply means there is nothing to show
  if (response.status === 404) {
    return {
      status: { message: 'Latest data not found', code: '404' },
      data: { metric_data: [] },
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`,
    )
  }

  return response.json()
}
