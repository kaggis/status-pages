import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useGetTenantReports } from '@/hooks/useTenants'
import {
  useGetLatestProblems,
  useGetResultsGroups,
  useGetStatusGroups,
} from '@/hooks/useData'
import { useGetTenantDowntimes } from '@/hooks/useDowntimes'
import { useGetTenantIncidents } from '@/hooks/useIncidents'
import { useCanManageIncidents } from '@/hooks/useCanManageIncidents'
import { useSelectedTenant } from '@/contexts/selected-tenant/useSelectedTenant'
import type { LatestMetricData } from '@/types/latestProblems'
import { buildStatusTimelineHref } from '@/utils/latestProblems'
import Dashboard from './Dashboard'
import { useGetResultsEndpoints } from '@/hooks/results'
import { useGetStatusTimelineAllEndpoints } from '@/hooks/useStatusTimeline'

const toUtcDate = (d: Date) => d.toISOString().split('T')[0]

const PrivateDashboardContainer = () => {
  const { id: tenantId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tenant } = useSelectedTenant()
  const tenantName = tenant?.info?.name ?? ''
  const { canManage } = useCanManageIncidents()

  const [searchParams, setSearchParams] = useSearchParams()
  const selectedReport = searchParams.get('report') ?? ''

  const {
    data: reports,
    isLoading: reportsLoading,
    error: reportsError,
  } = useGetTenantReports(tenantId ?? '')

  const selectedReportValid =
    reports?.some((r) => r.name === selectedReport) ?? false

  const setSelectedReport = useCallback(
    (name: string) => {
      const next = new URLSearchParams(searchParams)
      if (name) next.set('report', name)
      else next.delete('report')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    if (!reports || reports.length === 0) return
    if (selectedReportValid) return
    setSelectedReport(reports[0].name)
  }, [reports, selectedReportValid, setSelectedReport])

  const today = toUtcDate(new Date())
  const reportReady = !!selectedReport && selectedReportValid

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
    tenantId ?? '',
    'private',
    selectedReport,
    endpointStatusStartTime,
    endpointStatusEndTime,
    reportReady,
  )

  const {
    data: resultsData,
    isLoading: resultsLoading,
    error: resultsError,
  } = useGetResultsGroups(
    tenantId ?? '',
    'private',
    selectedReport,
    undefined,
    '1w',
    reportReady,
  )

  const {
    data: endpointsData,
    isLoading: endpointsLoading,
    error: endpointsError,
  } = useGetResultsEndpoints(
    tenantId ?? '',
    'private',
    selectedReport,
    startTime,
    endTime,
    'daily',
    reportReady,
  )

  // The private latest-data endpoint is addressed by report ID, not name
  const selectedReportId =
    reports?.find((r) => r.name === selectedReport)?.id ?? ''

  const {
    data: latestProblemsData,
    isLoading: latestProblemsLoading,
    error: latestProblemsError,
    dataUpdatedAt: latestProblemsUpdatedAt,
  } = useGetLatestProblems(tenantId ?? '', 'private', selectedReportId, {
    enabled: reportReady && !!selectedReportId,
  })

  // Deep link to the status timeline for a single metric (uses report NAME)
  const getMetricStatusHref = useCallback(
    (check: LatestMetricData) =>
      buildStatusTimelineHref(
        `/tenants/${tenantId}/status`,
        selectedReport,
        check,
      ),
    [tenantId, selectedReport],
  )

  const {
    data: downtimesData,
    isLoading: downtimesLoading,
    error: downtimesError,
  } = useGetTenantDowntimes(tenantId ?? '', 'private', {
    size: 100,
    date: today,
    enabled: true,
  })

  const downtimes = downtimesData?.pages.flatMap((page) => page.content) ?? []

  const {
    data: incidentsData,
    isLoading: incidentsLoading,
    error: incidentsError,
  } = useGetTenantIncidents(tenantId ?? '', 'private', {
    size: 100,
    enabled: true,
  })

  const incidents = incidentsData?.pages.flatMap((page) => page.content) ?? []

  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
  } = useGetStatusGroups(
    tenantId ?? '',
    'private',
    selectedReport,
    undefined,
    reportReady,
  )

  const openGroup = (groupName: string, endpointName?: string) => {
    const params = new URLSearchParams({ report: selectedReport })
    if (endpointName) params.set('endpoint', endpointName)
    navigate(
      `/tenants/${tenantId}/dashboard/groups/${encodeURIComponent(groupName)}` +
        `?${params.toString()}`,
    )
  }

  if (!tenantId) {
    return (
      <div className="page-container">
        <p className="text-sm text-muted">No tenant selected.</p>
      </div>
    )
  }

  return (
    <Dashboard
      tenantName={tenantName}
      tenantId={tenantId}
      reports={reports}
      downtimesData={downtimes}
      downtimesLoading={downtimesLoading}
      downtimesError={downtimesError}
      incidentsData={incidents}
      incidentsLoading={incidentsLoading}
      incidentsError={incidentsError}
      canManageIncidents={canManage}
      reportsLoading={reportsLoading}
      reportsError={reportsError ?? null}
      resultsData={resultsData}
      resultsLoading={resultsLoading}
      resultsError={resultsError ?? null}
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
      statusData={statusData}
      statusLoading={statusLoading}
      statusError={statusError ?? null}
      selectedReport={selectedReport}
      onReportChange={setSelectedReport}
      onGroupSelect={(name) => openGroup(name)}
      onEndpointSelect={(group, endpoint) => openGroup(group, endpoint)}
    />
  )
}

export default PrivateDashboardContainer
