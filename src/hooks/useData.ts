import {
  fetchLatestMetricData,
  fetchResultsGroupDetails,
  fetchResultsGroupEndpoints,
  fetchResultsGroups,
  fetchStatusGroups,
  type LatestMetricDataParams,
} from '@/api/data'
import { useAuth } from '@/auth/useAuth'
import type { AccessMode } from '@/types/common'
import type {
  GroupDetailResponse,
  GroupEndpointsResponse,
  GroupResultsResponse,
  GroupStatusResponse,
} from '@/types/data'
import type {
  LatestMetricData,
  LatestMetricDataResponse,
} from '@/types/latestProblems'
import { selectLatestProblems } from '@/utils/latestProblems'
import { useQuery } from '@tanstack/react-query'

export const useGetResultsGroups = (
  tenantIdentifier: string,
  mode: AccessMode,
  report?: string,
  item?: string,
  period?: string,
  enabled: boolean = true,
) => {
  const { token } = useAuth()

  return useQuery<GroupResultsResponse, Error>({
    queryKey: ['results-groups', mode, tenantIdentifier, report, item, period],
    queryFn: () => {
      if (mode === 'private' && !token) {
        throw new Error('No authentication token available')
      }
      if (!tenantIdentifier) throw new Error('Tenant identifier is required')
      return fetchResultsGroups(
        tenantIdentifier,
        report,
        item,
        period,
        mode,
        mode === 'private' ? token : undefined,
      )
    },
    retry: false,
    refetchOnMount: 'always',
    enabled:
      enabled && (mode === 'private' ? !!token : true) && !!tenantIdentifier,
  })
}

export const useGetStatusGroups = (
  tenantIdentifier: string,
  mode: AccessMode,
  report: string = '',
  item?: string,
  enabled: boolean = true,
) => {
  const { token } = useAuth()

  return useQuery<GroupStatusResponse, Error>({
    queryKey: ['status-groups', mode, tenantIdentifier, report, item],
    queryFn: () => {
      if (mode === 'private' && !token) {
        throw new Error('No authentication token available')
      }
      if (!tenantIdentifier) throw new Error('Tenant identifier is required')
      return fetchStatusGroups(
        tenantIdentifier,
        report,
        item,
        mode,
        mode === 'private' ? token : undefined,
      )
    },
    retry: false,
    refetchOnMount: 'always',
    enabled:
      enabled && (mode === 'private' ? !!token : true) && !!tenantIdentifier,
  })
}

export const useGetResultsGroupDetails = (
  tenantIdentifier: string,
  mode: AccessMode,
  report: string,
  groupName: string,
  startTime: string,
  endTime: string,
  granularity: string = 'daily',
  enabled: boolean = true,
) => {
  const { token } = useAuth()

  return useQuery<GroupDetailResponse, Error>({
    queryKey: [
      'results-group-details',
      mode,
      tenantIdentifier,
      report,
      groupName,
      startTime,
      endTime,
      granularity,
    ],
    queryFn: () => {
      if (mode === 'private' && !token) {
        throw new Error('No authentication token available')
      }
      if (!tenantIdentifier) throw new Error('Tenant identifier is required')
      return fetchResultsGroupDetails(
        tenantIdentifier,
        report,
        groupName,
        startTime,
        endTime,
        granularity,
        mode,
        mode === 'private' ? token : undefined,
      )
    },
    retry: false,
    refetchOnMount: 'always',
    enabled:
      enabled &&
      (mode === 'private' ? !!token : true) &&
      !!tenantIdentifier &&
      !!report &&
      !!groupName,
  })
}

export const useGetResultsGroupEndpoints = (
  tenantIdentifier: string,
  mode: AccessMode,
  report: string,
  groupName: string,
  startTime: string,
  endTime: string,
  granularity: string = 'daily',
  enabled: boolean = true,
) => {
  const { token } = useAuth()

  return useQuery<GroupEndpointsResponse, Error>({
    queryKey: [
      'results-group-endpoints',
      mode,
      tenantIdentifier,
      report,
      groupName,
      startTime,
      endTime,
      granularity,
    ],
    queryFn: () => {
      if (mode === 'private' && !token) {
        throw new Error('No authentication token available')
      }
      if (!tenantIdentifier) throw new Error('Tenant identifier is required')
      return fetchResultsGroupEndpoints(
        tenantIdentifier,
        report,
        groupName,
        startTime,
        endTime,
        granularity,
        mode,
        mode === 'private' ? token : undefined,
      )
    },
    retry: false,
    refetchOnMount: 'always',
    enabled:
      enabled &&
      (mode === 'private' ? !!token : true) &&
      !!tenantIdentifier &&
      !!report &&
      !!groupName,
  })
}

interface UseGetLatestProblemsOptions extends LatestMetricDataParams {
  enabled?: boolean
  /** Polling interval in ms; set to false to disable */
  refetchInterval?: number | false
}

/**
 * Latest problematic checks (non-OK) for a report, newest first.
 * Uses strict mode so each metric appears once with its current state.
 * In private mode `report` is the report ID.
 */
export const useGetLatestProblems = (
  tenantIdentifier: string,
  mode: AccessMode,
  report: string,
  {
    filter = 'all',
    limit = 500,
    strict = true,
    group,
    enabled = true,
    refetchInterval = 60_000,
  }: UseGetLatestProblemsOptions = {},
) => {
  const { token } = useAuth()

  return useQuery<LatestMetricDataResponse, Error, LatestMetricData[]>({
    queryKey: [
      'latest-problems',
      mode,
      tenantIdentifier,
      report,
      group ?? null,
      filter,
      limit,
      strict,
    ],
    queryFn: () => {
      if (mode === 'private' && !token) {
        throw new Error('No authentication token available')
      }
      if (!tenantIdentifier) throw new Error('Tenant identifier is required')
      return fetchLatestMetricData(
        tenantIdentifier,
        report,
        mode,
        mode === 'private' ? token : undefined,
        { filter, limit, strict, group },
      )
    },
    select: selectLatestProblems,
    retry: false,
    refetchOnMount: 'always',
    refetchInterval,
    enabled:
      enabled &&
      (mode === 'private' ? !!token : true) &&
      !!tenantIdentifier &&
      !!report,
  })
}
