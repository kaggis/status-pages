import { useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useGetPublicTenantReports } from '@/hooks/useTenants'
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
import { useTenantName } from '@/hooks/useTenantName'
import type { LatestMetricData } from '@/types/latestProblems'
import { buildStatusTimelineHref } from '@/utils/latestProblems'
import GroupDashboard from '@/pages/dashboard/GroupDashboard'
import { useSelectedPublicReport } from './hooks/useSelectedPublicReport'

const toUtcDate = (d: Date) => d.toISOString().split('T')[0]

const PublicGroupDashboard = () => {
  const { tenantName } = useTenantName()
  const { groupName = '' } = useParams<{
    groupName: string
  }>()

  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const focusEndpoint = searchParams.get('endpoint') ?? undefined

  const { data: reports } = useGetPublicTenantReports(tenantName ?? '')

  const setReportParam = useCallback(
    (report: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('report', report)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const selectedReport = useSelectedPublicReport(
    reports,
    searchParams.get('report'),
    setReportParam,
  )

  const today = toUtcDate(new Date())

  /*
   * Results / availability data:
   * last 7 days through today.
   */
  const { startTime, endTime } = useMemo(() => {
    const now = new Date(`${today}T00:00:00Z`)
    const start = new Date(now)

    start.setUTCDate(start.getUTCDate() - 7)

    return {
      startTime: `${toUtcDate(start)}T00:00:00Z`,
      endTime: `${today}T23:59:59Z`,
    }
  }, [today])

  /*
   * Status data:
   * today only.
   *
   * These values are intentionally stable so they do not
   * change on every render and create new React Query keys.
   */
  const statusStartTime = `${today}T00:00:00Z`
  const statusEndTime = `${today}T23:59:59Z`

  const enabled = !!selectedReport && !!groupName && !!tenantName

  const {
    data: detailsData,
    isLoading: detailsLoading,
    error: detailsError,
  } = useGetResultsGroupDetails(
    tenantName ?? '',
    'public',
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
    tenantName ?? '',
    'public',
    selectedReport,
    groupName,
    startTime,
    endTime,
    'daily',
    enabled,
  )

  /*
   * Actual group status from the status backend.
   */
  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
  } = useGetStatusTimelineGroup(
    tenantName ?? '',
    'public',
    selectedReport,
    groupName,
    statusStartTime,
    statusEndTime,
    enabled,
  )

  /*
   * Actual status timelines for every endpoint in the group.
   */
  const {
    data: statusEndpointsData,
    isLoading: statusEndpointsLoading,
    error: statusEndpointsError,
  } = useGetStatusTimelineGroupEndpoints(
    tenantName ?? '',
    'public',
    selectedReport,
    groupName,
    statusStartTime,
    statusEndTime,
    enabled,
  )

  /*
   * Latest failing checks for this group (public: tenant NAME + report NAME).
   */
  const {
    data: latestProblemsData,
    isLoading: latestProblemsLoading,
    error: latestProblemsError,
    dataUpdatedAt: latestProblemsUpdatedAt,
  } = useGetLatestProblems(tenantName ?? '', 'public', selectedReport ?? '', {
    group: groupName,
    enabled,
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

  const backToDashboard = () =>
    navigate(
      `/public/tenants/${encodeURIComponent(tenantName ?? '')}/dashboard` +
        (selectedReport ? `?report=${encodeURIComponent(selectedReport)}` : ''),
    )

  return (
    <GroupDashboard
      tenantName={tenantName ?? ''}
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

export default PublicGroupDashboard
