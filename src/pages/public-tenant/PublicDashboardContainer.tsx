import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGetPublicTenantReports } from '@/hooks/useTenants'
import {
  useGetLatestProblems,
  useGetResultsGroups,
  useGetStatusGroups,
} from '@/hooks/useData'
import { useTenantName } from '@/hooks/useTenantName'
import Dashboard from '@/pages/dashboard/Dashboard'
import { useGetResultsEndpoints } from '@/hooks/results'
import { useGetTenantDowntimes } from '@/hooks/useDowntimes'
import { useGetTenantIncidents } from '@/hooks/useIncidents'
import { useGetStatusTimelineAllEndpoints } from '@/hooks/useStatusTimeline'
import type { LatestMetricData } from '@/types/latestProblems'
import { buildStatusTimelineHref } from '@/utils/latestProblems'
import { useSelectedPublicReport } from './hooks/useSelectedPublicReport'

const toUtcDate = (d: Date) => d.toISOString().split('T')[0]

const PublicDashboardContainer = () => {
  const { tenantName } = useTenantName()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    data: reports,
    isLoading: reportsLoading,
    error: reportsError,
  } = useGetPublicTenantReports(tenantName ?? '')

  const setReportParam = (report: string) => {
    setSearchParams({ report }, { replace: true })
  }

  const selectedReport = useSelectedPublicReport(
    reports,
    searchParams.get('report'),
    setReportParam,
  )

  const today = toUtcDate(new Date())

  const { startTime, endTime } = useMemo(() => {
    const now = new Date(`${today}T00:00:00Z`)
    const start = new Date(now)

    start.setUTCDate(start.getUTCDate() - 7)

    return {
      startTime: `${toUtcDate(start)}T00:00:00Z`,
      endTime: `${today}T23:59:59Z`,
    }
  }, [today])

  const endpointStatusStartTime = `${today}T00:00:00Z`
  const endpointStatusEndTime = `${today}T23:59:59Z`

  const {
    data: endpointStatusData,
    isLoading: endpointStatusLoading,
    error: endpointStatusError,
  } = useGetStatusTimelineAllEndpoints(
    tenantName ?? '',
    'public',
    selectedReport,
    endpointStatusStartTime,
    endpointStatusEndTime,
    !!selectedReport,
  )

  const {
    data: resultsData,
    isLoading: resultsLoading,
    error: resultsError,
  } = useGetResultsGroups(
    tenantName ?? '',
    'public',
    selectedReport,
    undefined,
    '1w',
    !!selectedReport,
  )

  // Public latest-data is addressed by tenant NAME + report NAME
  const {
    data: latestProblemsData,
    isLoading: latestProblemsLoading,
    error: latestProblemsError,
    dataUpdatedAt: latestProblemsUpdatedAt,
  } = useGetLatestProblems(tenantName ?? '', 'public', selectedReport ?? '', {
    enabled: !!selectedReport,
  })

  // ⚠️ Assumed public status route; adjust to match your router
  const getMetricStatusHref = useCallback(
    (check: LatestMetricData) =>
      buildStatusTimelineHref(
        `/public/tenants/${encodeURIComponent(tenantName ?? '')}/status`,
        selectedReport ?? '',
        check,
      ),
    [tenantName, selectedReport],
  )

  const {
    data: downtimesData,
    isLoading: downtimesLoading,
    error: downtimesError,
  } = useGetTenantDowntimes(tenantName ?? '', 'public', {
    size: 100,
    date: today,
    enabled: true,
  })

  const downtimes = downtimesData?.pages.flatMap((page) => page.content) ?? []

  const {
    data: incidentsData,
    isLoading: incidentsLoading,
    error: incidentsError,
  } = useGetTenantIncidents(tenantName ?? '', 'public', {
    size: 100,
    enabled: true,
  })

  const incidents = incidentsData?.pages.flatMap((page) => page.content) ?? []

  const {
    data: endpointsData,
    isLoading: endpointsLoading,
    error: endpointsError,
  } = useGetResultsEndpoints(
    tenantName ?? '',
    'public',
    selectedReport,
    startTime,
    endTime,
    'daily',
    !!selectedReport,
  )

  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
  } = useGetStatusGroups(
    tenantName ?? '',
    'public',
    selectedReport,
    undefined,
    !!selectedReport,
  )

  const openGroup = (groupName: string, endpointName?: string) => {
    const params = new URLSearchParams()
    if (endpointName) params.set('endpoint', endpointName)
    if (selectedReport) params.set('report', selectedReport)
    const query = params.toString() ? `?${params.toString()}` : ''

    navigate(
      `/public/tenants/${encodeURIComponent(tenantName ?? '')}` +
        `/dashboard/groups/${encodeURIComponent(groupName)}${query}`,
    )
  }

  return (
    <Dashboard
      tenantName={tenantName ?? ''}
      reports={reports}
      reportsLoading={reportsLoading}
      reportsError={reportsError ?? null}
      downtimesData={downtimes}
      downtimesLoading={downtimesLoading}
      downtimesError={downtimesError}
      incidentsData={incidents}
      incidentsLoading={incidentsLoading}
      incidentsError={incidentsError}
      resultsData={resultsData}
      resultsLoading={resultsLoading}
      resultsError={resultsError ?? null}
      statusData={statusData}
      statusLoading={statusLoading}
      statusError={statusError ?? null}
      endpointsData={endpointsData}
      endpointsLoading={endpointsLoading}
      endpointsError={endpointsError ?? null}
      endpointStatusData={endpointStatusData}
      endpointStatusLoading={endpointStatusLoading}
      endpointStatusError={endpointStatusError ?? null}
      latestProblems={{
        data: latestProblemsData,
        isLoading: latestProblemsLoading,
        error: latestProblemsError ?? null,
        updatedAt: latestProblemsUpdatedAt || undefined,
        getMetricHref: getMetricStatusHref,
      }}
      selectedReport={selectedReport}
      onReportChange={setReportParam}
      onGroupSelect={(name) => openGroup(name)}
      onEndpointSelect={(group, endpoint) => openGroup(group, endpoint)}
    />
  )
}

export default PublicDashboardContainer
