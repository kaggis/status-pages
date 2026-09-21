import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useGetTenantReports } from '@/hooks/useTenants'
import {
  useGetLatestProblems,
  useGetResultsGroupDetails,
  useGetResultsGroupEndpoints,
} from '@/hooks/useData'
import {
  useGetStatusTimelineGroup,
  useGetStatusTimelineGroupEndpoints,
} from '@/hooks/useStatusTimeline'
import { useGetTenantDowntimes } from '@/hooks/useDowntimes'
import { useGetTenantIncidents } from '@/hooks/useIncidents'
import { useCanManageIncidents } from '@/hooks/useCanManageIncidents'
import { useSelectedTenant } from '@/contexts/selected-tenant/useSelectedTenant'
import type { LatestMetricData } from '@/types/latestProblems'
import { buildStatusTimelineHref } from '@/utils/latestProblems'

import GroupDashboard from './GroupDashboard'

const toUtcDate = (d: Date) => d.toISOString().split('T')[0]

const PrivateGroupDashboard = () => {
  const { id: tenantId, groupName = '' } = useParams<{
    id: string
    groupName: string
  }>()

  const navigate = useNavigate()
  const { tenant } = useSelectedTenant()
  const tenantName = tenant?.info?.name ?? ''
  const { canManage } = useCanManageIncidents()

  const [searchParams, setSearchParams] = useSearchParams()

  const selectedReport = searchParams.get('report') ?? ''
  const focusEndpoint = searchParams.get('endpoint') ?? undefined

  const { data: reports } = useGetTenantReports(tenantId ?? '')

  const selectedReportValid =
    reports?.some((r) => r.name === selectedReport) ?? false

  useEffect(() => {
    if (!reports || reports.length === 0) return
    if (selectedReportValid) return

    const next = new URLSearchParams(searchParams)
    next.set('report', reports[0].name)

    setSearchParams(next, { replace: true })
  }, [reports, selectedReportValid, searchParams, setSearchParams])

  const today = toUtcDate(new Date())

  // Results / availability data: last 7 days through today.
  const { startTime, endTime } = useMemo(() => {
    const now = new Date(`${today}T00:00:00Z`)
    const start = new Date(now)

    start.setUTCDate(start.getUTCDate() - 7)

    return {
      startTime: `${toUtcDate(start)}T00:00:00Z`,
      endTime: `${today}T23:59:59Z`,
    }
  }, [today])

  // Status data: today only, with a stable query range.
  const statusStartTime = `${today}T00:00:00Z`
  const statusEndTime = `${today}T23:59:59Z`

  const enabled = !!selectedReport && selectedReportValid && !!groupName

  const {
    data: detailsData,
    isLoading: detailsLoading,
    error: detailsError,
  } = useGetResultsGroupDetails(
    tenantId ?? '',
    'private',
    selectedReport,
    groupName,
    startTime,
    endTime,
    'daily',
    enabled,
  )

  const {
    data: endpointsData,
    isLoading: endpointsLoading,
    error: endpointsError,
  } = useGetResultsGroupEndpoints(
    tenantId ?? '',
    'private',
    selectedReport,
    groupName,
    startTime,
    endTime,
    'daily',
    enabled,
  )

  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
  } = useGetStatusTimelineGroup(
    tenantId ?? '',
    'private',
    selectedReport,
    groupName,
    statusStartTime,
    statusEndTime,
    enabled,
  )

  const {
    data: statusEndpointsData,
    isLoading: statusEndpointsLoading,
    error: statusEndpointsError,
  } = useGetStatusTimelineGroupEndpoints(
    tenantId ?? '',
    'private',
    selectedReport,
    groupName,
    statusStartTime,
    statusEndTime,
    enabled,
  )

  // Group-scoped latest data: /v1/tenants/{id}/report/{report-id}/groups/{group-name}/latest-data
  const selectedReportId =
    reports?.find((r) => r.name === selectedReport)?.id ?? ''

  const {
    data: latestProblemsData,
    isLoading: latestProblemsLoading,
    error: latestProblemsError,
    dataUpdatedAt: latestProblemsUpdatedAt,
  } = useGetLatestProblems(tenantId ?? '', 'private', selectedReportId, {
    group: groupName,
    enabled: enabled && !!selectedReportId,
  })

  const getMetricStatusHref = useCallback(
    (check: LatestMetricData) =>
      buildStatusTimelineHref(
        `/tenants/${tenantId}/status`,
        selectedReport,
        check,
      ),
    [tenantId, selectedReport],
  )

  // Focus an endpoint row on this page via ?endpoint=
  const focusEndpointOnPage = useCallback(
    (endpointName: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('endpoint', endpointName)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
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

  const backToDashboard = () =>
    navigate(
      `/tenants/${tenantId}/dashboard` +
        (selectedReport ? `?report=${encodeURIComponent(selectedReport)}` : ''),
    )

  if (!tenantId) {
    return (
      <div className="page-container">
        <p className="text-sm text-muted">No tenant selected.</p>
      </div>
    )
  }

  return (
    <GroupDashboard
      tenantName={tenantName}
      tenantId={tenantId}
      selectedReport={selectedReport}
      groupName={groupName}
      detailsData={detailsData}
      detailsLoading={detailsLoading}
      detailsError={detailsError ?? null}
      endpointsData={endpointsData}
      endpointsLoading={endpointsLoading}
      endpointsError={endpointsError ?? null}
      statusData={statusData}
      statusLoading={statusLoading}
      statusError={statusError ?? null}
      statusEndpointsData={statusEndpointsData}
      statusEndpointsLoading={statusEndpointsLoading}
      statusEndpointsError={statusEndpointsError ?? null}
      focusEndpoint={focusEndpoint}
      downtimesData={downtimes}
      downtimesLoading={downtimesLoading}
      downtimesError={downtimesError ?? null}
      incidentsData={incidents}
      incidentsLoading={incidentsLoading}
      incidentsError={incidentsError ?? null}
      canManageIncidents={canManage}
      latestProblems={{
        data: latestProblemsData,
        isLoading: latestProblemsLoading,
        error: latestProblemsError ?? null,
        updatedAt: latestProblemsUpdatedAt || undefined,
        getMetricHref: getMetricStatusHref,
      }}
      onEndpointFocus={focusEndpointOnPage}
      onBack={backToDashboard}
    />
  )
}

export default PrivateGroupDashboard
