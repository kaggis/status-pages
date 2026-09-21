import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  HardDriveIcon,
  Info,
  Server,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline'

import PageHeader from '@/components/PageHeader'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorDisplay from '@/components/ErrorDisplay'
import SearchInput from '@/components/SearchInput'

import type {
  GroupDetailResponse,
  GroupEndpointsResponse,
  GroupResultEntry,
} from '@/types/data'
import type { LatestMetricData } from '@/types/latestProblems'

import type { StatusNode } from '@/types/statusTimeline'

import type { Downtime } from '@/types/downtimes'
import type { Incident } from '@/types/incidents'
import { categorizeDowntimes, fmtDowntimeDailyRange } from '@/utils/downtimes'
import { getBannerIncidents } from '@/utils/incidents'
import { formatDateTime } from '@/utils/formatDateTime'
import { stripIdSuffix } from '@/utils/cleanup'
import IncidentBanner from './IncidentBanner'
import LatestProblemsDrawer from './LatestProblemsDrawer'

type ServiceStatus = 'healthy' | 'degraded' | 'critical' | 'missing'
type FilterId = 'all' | 'problem' | 'healthy'
type DowntimeGroup = 'active' | 'upcoming' | 'completed'

interface EndpointRow {
  key: string
  name: string
  service: string
  status: ServiceStatus
  daily: number[]
}

interface GroupModel {
  name: string
  type: string
  dates: string[]
  daily: number[]
  endpoints: EndpointRow[]
}

const mapStatusValue = (value: string): ServiceStatus => {
  const v = value?.toUpperCase()

  if (v === 'CRITICAL' || v === 'DOWN') return 'critical'
  if (v === 'WARNING' || v === 'DEGRADED') return 'degraded'
  if (!v || v === 'UNKNOWN' || v === 'MISSING') return 'missing'

  return 'healthy'
}

const latestStatus = (node: StatusNode | undefined): ServiceStatus => {
  if (!node?.statuses?.length) return 'missing'

  const latest = node.statuses.reduce((current, candidate) =>
    new Date(candidate.timestamp).getTime() >
    new Date(current.timestamp).getTime()
      ? candidate
      : current,
  )

  return mapStatusValue(latest.value)
}

const avgValid = (arr: number[]): number | null => {
  const valid = arr.filter((v) => v >= 0)

  return valid.length === 0
    ? null
    : valid.reduce((a, b) => a + b, 0) / valid.length
}

const toNumber = (value: string | undefined): number => {
  const n = Number(value)

  return Number.isFinite(n) ? n : -1
}

const averageSeries = (series: number[][], length: number) =>
  Array.from({ length }, (_, i) => {
    const avg = avgValid(series.map((d) => d[i] ?? -1))

    return avg === null ? -1 : avg
  })

const WEEK_DAY_COUNT = 7

const lastNDates = (endIso: string, count: number): string[] => {
  const end = new Date(`${endIso}T00:00:00Z`)
  const out: string[] = []

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }

  return out
}

const buildWeekAxis = (reported: Set<string>): string[] => {
  const today = new Date().toISOString().slice(0, 10)

  return [
    ...new Set([...lastNDates(today, WEEK_DAY_COUNT), ...reported]),
  ].sort()
}

const formatShortDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
  })

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })

const uptimeTone = (pct: number) => {
  if (pct >= 99.99) return 'bg-emerald-500'
  if (pct >= 98) return 'bg-amber-500'

  return 'bg-red-500'
}

const STATUS_STYLES: Record<
  ServiceStatus,
  {
    dot: string
    pill: string
    text: string
    label: string
  }
> = {
  healthy: {
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    text: 'text-emerald-700',
    label: 'Healthy',
  },
  degraded: {
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    text: 'text-amber-700',
    label: 'Warning',
  },
  critical: {
    dot: 'bg-red-500',
    pill: 'bg-red-50 text-red-700 ring-red-600/20',
    text: 'text-red-700',
    label: 'Critical',
  },
  missing: {
    dot: 'bg-gray-400',
    pill: 'bg-gray-50 text-gray-600 ring-gray-500/20',
    text: 'text-gray-600',
    label: 'Missing',
  },
}

const BANNER_STYLES: Record<
  ServiceStatus,
  {
    bg: string
    border: string
    icon: LucideIcon
    headline: string
    detail: string
    meta: string
  }
> = {
  healthy: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-700',
    icon: CheckCircle2,
    headline: 'text-emerald-900',
    detail: 'text-emerald-800/80',
    meta: 'text-emerald-800/60',
  },
  degraded: {
    bg: 'bg-amber-50',
    border: 'border-amber-700',
    icon: AlertTriangle,
    headline: 'text-amber-900',
    detail: 'text-amber-900/80',
    meta: 'text-amber-900/60',
  },
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-700',
    icon: AlertOctagon,
    headline: 'text-red-900',
    detail: 'text-red-900/80',
    meta: 'text-red-900/60',
  },
  missing: {
    bg: 'bg-gray-50',
    border: 'border-gray-400',
    icon: Info,
    headline: 'text-gray-600',
    detail: 'text-gray-600/80',
    meta: 'text-gray-600/60',
  },
}

const DOWNTIME_TYPE_STYLES: Record<
  DowntimeGroup,
  {
    label: string
    labelClass: string
    pillClass: string
    nameClass: string
    timeClass: string
  }
> = {
  active: {
    label: 'Active',
    labelClass: 'text-green-700',
    pillClass: 'bg-green-50 border-green-700',
    nameClass: 'font-bold text-green-700',
    timeClass: 'text-gray-600',
  },
  upcoming: {
    label: 'Upcoming',
    labelClass: 'text-amber-700',
    pillClass: 'bg-amber-100 border-amber-700',
    nameClass: 'font-medium text-amber-700',
    timeClass: 'text-gray-600',
  },
  completed: {
    label: 'Completed',
    labelClass: 'text-gray-700',
    pillClass: 'bg-white border-gray-200',
    nameClass: 'font-medium text-gray-700',
    timeClass: 'text-gray-400',
  },
}

function DowntimePill({
  item,
  group,
}: {
  item: Downtime
  group: DowntimeGroup
}) {
  const s = DOWNTIME_TYPE_STYLES[group]

  return (
    <span
      className={`tooltip tooltip-bottom cursor-pointer inline-flex items-center gap-1.5 rounded-full border mx-1 my-0.5 px-2.5 py-0.5 text-[12px] ${s.pillClass}`}
    >
      <div className="tooltip-content text-[12px]">
        <div className="font-bold mb-1">Downtime: {item.name}</div>
        <div>
          start:{' '}
          {formatDateTime(item.scheduled_at, {
            seconds: true,
            utcSuffix: true,
          })}
        </div>
        <div>
          end:{' '}
          {item.completed_at
            ? formatDateTime(item.completed_at, {
                seconds: true,
                utcSuffix: true,
              })
            : '—'}
        </div>

        <div className="font-bold mb-1 mt-2">Affected endpoints:</div>

        <ul>
          {(item.services ?? []).map((s2, i) => (
            <li key={`${s2.hostname}-${s2.service}-${i}`}>
              <HardDriveIcon size={16} className="inline me-2 text-10" />
              {stripIdSuffix(s2.hostname)}({s2.service})
            </li>
          ))}
        </ul>
      </div>

      <span className={`${s.nameClass} truncate max-w-[18rem]`}>
        {item.name}
      </span>

      <span className={s.timeClass}>
        {fmtDowntimeDailyRange(item.scheduled_at, item.completed_at || '')}
      </span>
    </span>
  )
}

function DowntimeTypeSection({
  group,
  items,
}: {
  group: DowntimeGroup
  items: Downtime[]
}) {
  if (items.length === 0) return null

  const s = DOWNTIME_TYPE_STYLES[group]

  return (
    <>
      <span className="mx-1">·</span>

      <span className={`ms-1 text-[13px] me-1 ${s.labelClass}`}>
        {s.label}:
      </span>

      {items.map((item, i) => (
        <DowntimePill key={item.name ?? i} item={item} group={group} />
      ))}
    </>
  )
}

interface NowItemProps {
  icon: LucideIcon
  label: string
  last?: boolean
  /** When set, the item renders as a button */
  onClick?: () => void
  title?: string
  children: ReactNode
}

const NowItem = ({
  icon: Icon,
  label,
  last,
  onClick,
  title,
  children,
}: NowItemProps) => {
  const base = `flex-1 min-w-[120px] px-4 py-2 ${
    last ? '' : 'border-r border-neutral-200'
  }`

  const content = (
    <>
      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
        <Icon className="h-3 w-3" strokeWidth={2} />
        <span>{label}</span>
        {onClick && (
          <ChevronRight
            className="ms-auto h-3.5 w-3.5 text-neutral-300 transition-colors group-hover:text-neutral-700"
            strokeWidth={2}
          />
        )}
      </div>

      <div className="mt-0.5 flex items-baseline gap-1.5 text-[15px] font-medium text-neutral-900 tabular-nums">
        {children}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`${base} group cursor-pointer rounded text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40`}
      >
        {content}
      </button>
    )
  }

  return <div className={base}>{content}</div>
}

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">
    {children}
  </p>
)

const LoadingBar = ({ active }: { active: boolean }) => (
  <div aria-hidden={active} className="flex w-full">
    {active && (
      <progress
        className="progress progress-primary h-[3px] w-full"
        aria-label="Loading endpoints"
      />
    )}
  </div>
)

interface WeekBarProps {
  value: number | null
  day: string
  fullDate: string
}

const WeekBar = ({ value, day, fullDate }: WeekBarProps) => {
  if (value === null) {
    return (
      <div
        className="flex h-full w-full flex-col items-center gap-1.5"
        title={`${fullDate}: No data`}
      >
        <span className="text-[10px] font-medium text-neutral-400">N/A</span>

        <div className="flex w-full flex-1 items-end">
          <div className="w-full rounded-t-[3px] bg-neutral-200 h-[8%]" />
        </div>

        <span className="text-[10px] text-neutral-400">{day}</span>
      </div>
    )
  }

  const h = Math.max(8, ((value - 98) / 2) * 100)

  return (
    <div
      className="flex h-full w-full flex-col items-center gap-1.5"
      title={`${fullDate}: ${value.toFixed(2)}%`}
    >
      <span className="text-[10px] font-medium tabular-nums text-neutral-700">
        {value.toFixed(2)}
      </span>

      <div className="flex w-full flex-1 items-end">
        <div
          className={`w-full rounded-t-[3px] ${uptimeTone(value)}`}
          style={{ height: `${h}%` }}
        />
      </div>

      <span className="text-[10px] text-neutral-400">{day}</span>
    </div>
  )
}

const MiniBars = ({ daily, dates }: { daily: number[]; dates: string[] }) => (
  <div
    className="grid gap-[2px]"
    style={{
      gridTemplateColumns: `repeat(${Math.max(
        daily.length,
        1,
      )}, minmax(0, 1fr))`,
    }}
  >
    {daily.map((p, i) => (
      <div
        key={i}
        className={`tooltip tooltip-top h-[18px] rounded-[2px] cursor-pointer opacity-90 hover:opacity-100 hover:scale-y-110 transition-all ${
          p === -1 ? 'bg-neutral-200' : uptimeTone(p)
        }`}
        data-tip={`${dates[i] ? formatShortDate(dates[i]) : ''}: ${
          p === -1 ? 'N/A' : `${p.toFixed(2)}%`
        }`}
      />
    ))}
  </div>
)

export interface GroupDashboardProps {
  tenantName: string
  tenantId?: string
  selectedReport: string
  groupName: string

  detailsData: GroupDetailResponse | undefined
  detailsLoading: boolean
  detailsError: Error | null

  endpointsData?: GroupEndpointsResponse
  endpointsLoading?: boolean
  endpointsError?: Error | null

  // Actual group status timeline
  statusData?: StatusNode[]
  statusLoading?: boolean
  statusError?: Error | null

  // Actual endpoint status timelines
  statusEndpointsData?: StatusNode[]
  statusEndpointsLoading?: boolean
  statusEndpointsError?: Error | null

  focusEndpoint?: string

  downtimesData?: Downtime[]
  downtimesLoading?: boolean
  downtimesError?: Error | null

  incidentsData?: Incident[]
  incidentsLoading?: boolean
  incidentsError?: Error | null
  canManageIncidents?: boolean

  /** Latest failing checks for this group. When omitted, counter, banner link and drawer are hidden. */
  latestProblems?: {
    data: LatestMetricData[] | undefined
    isLoading: boolean
    error: Error | null
    updatedAt?: number
    /** Status-timeline deep link for a check (mode-specific, built by the container) */
    getMetricHref?: (check: LatestMetricData) => string
  }
  /** Focus an endpoint row on this page (e.g. sets ?endpoint=) */
  onEndpointFocus?: (endpointName: string) => void

  onBack: () => void
}

const GroupDashboard = ({
  tenantName,
  tenantId,
  selectedReport,
  groupName,
  detailsData,
  detailsLoading,
  detailsError,
  endpointsData,
  endpointsLoading,
  endpointsError,
  statusData,
  statusLoading,
  statusError,
  statusEndpointsData,
  statusEndpointsLoading,
  statusEndpointsError,
  focusEndpoint,
  downtimesData,
  downtimesLoading,
  downtimesError,
  incidentsData,
  incidentsLoading,
  incidentsError,
  canManageIncidents,
  latestProblems,
  onEndpointFocus,
  onBack,
}: GroupDashboardProps) => {
  const [filter, setFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')
  const [problemsOpen, setProblemsOpen] = useState(false)

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  const openProblems = useCallback(() => setProblemsOpen(true), [])
  const closeProblems = useCallback(() => setProblemsOpen(false), [])

  const handleProblemEndpointSelect = useCallback(
    (_groupName: string, endpointName: string) => {
      setProblemsOpen(false)
      // Make sure the row is visible even if a filter/search hides it
      setFilter('all')
      setSearch('')
      onEndpointFocus?.(endpointName)
    },
    [onEndpointFocus],
  )

  const group = useMemo<GroupModel | undefined>(() => {
    if (!detailsData) return undefined

    const projects = detailsData.results ?? []

    const groupNode =
      projects
        .flatMap((p) => p.groups ?? [])
        .find((g) => g.name === groupName) ??
      projects.flatMap((p) => p.groups ?? [])[0] ??
      projects.find((p) => p.name === groupName) ??
      projects[0]

    const serviceTypeNodes =
      (endpointsData?.results?.find((r) => r.name === groupName) ??
        endpointsData?.results?.[0])?.['service-types'] ?? []

    const dateSet = new Set<string>()

    const collect = (results: GroupResultEntry[] | undefined) =>
      results?.forEach((r) => dateSet.add(r.timestamp.slice(0, 10)))

    collect(groupNode?.results)

    serviceTypeNodes.forEach((st) =>
      st.endpoints?.forEach((ep) => collect(ep.results)),
    )

    const dates = buildWeekAxis(dateSet)

    const seriesFrom = (results: GroupResultEntry[] | undefined) => {
      const byDate = new Map<string, number>()

      results?.forEach((r) =>
        byDate.set(r.timestamp.slice(0, 10), toNumber(r.availability)),
      )

      return dates.map((d) => byDate.get(d) ?? -1)
    }

    const endpoints: EndpointRow[] = serviceTypeNodes.flatMap((st) =>
      (st.endpoints ?? []).map((ep) => ({
        key: `${st.name}|${ep.name}`,
        name: ep.name,
        service: st.name,
        status: 'missing',
        daily: seriesFrom(ep.results),
      })),
    )

    endpoints.sort((a, b) => a.name.localeCompare(b.name))

    return {
      name: groupNode?.name ?? groupName,
      type: groupNode?.type ?? '',
      dates,
      daily: groupNode?.results?.length
        ? seriesFrom(groupNode.results)
        : averageSeries(
            endpoints.map((e) => e.daily),
            dates.length,
          ),
      endpoints,
    }
  }, [detailsData, endpointsData, groupName])

  const status = useMemo<ServiceStatus>(() => {
    const entry =
      statusData?.find((g) => g.name === groupName) ?? statusData?.[0]

    return latestStatus(entry)
  }, [statusData, groupName])

  const endpointStatusByName = useMemo(() => {
    const map = new Map<string, ServiceStatus>()

    statusEndpointsData?.forEach((endpoint) => {
      map.set(endpoint.name, latestStatus(endpoint))
    })

    return map
  }, [statusEndpointsData])

  const endpoints = useMemo(
    () =>
      (group?.endpoints ?? []).map((ep) => ({
        ...ep,

        // IMPORTANT:
        // Endpoint status comes from the status backend,
        // not from availability.
        status: endpointStatusByName.get(ep.name) ?? 'missing',
      })),
    [group, endpointStatusByName],
  )

  const health = useMemo(
    () =>
      endpoints.map((ep) => ({
        key: ep.key,
        name: stripIdSuffix(ep.name),
        status: ep.status,
      })),
    [endpoints],
  )

  const healthByKey = useMemo(
    () => new Map(health.map((e) => [e.key, e.status])),
    [health],
  )

  const focusKey = useMemo(
    () => endpoints.find((ep) => ep.name === focusEndpoint)?.key,
    [endpoints, focusEndpoint],
  )

  useEffect(() => {
    if (!focusKey) return

    const row = rowRefs.current[focusKey]

    if (!row) return

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    row.scrollIntoView({
      block: 'center',
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [focusKey])

  const counts = useMemo<Record<ServiceStatus, number>>(() => {
    const c = {
      healthy: 0,
      degraded: 0,
      critical: 0,
      missing: 0,
    }

    health.forEach((e) => c[e.status]++)

    return c
  }, [health])

  const groupDaily = useMemo<Array<number | null>>(
    () => (group?.daily ?? []).map((v) => (v >= 0 ? v : null)),
    [group],
  )

  const weekAvgValue = useMemo(() => avgValid(group?.daily ?? []), [group])

  const weekAvg = weekAvgValue === null ? 'N/A' : weekAvgValue.toFixed(2)

  const todayAvail = (() => {
    if (groupDaily.length === 0) return '—'

    const last = groupDaily[groupDaily.length - 1]

    return last === null ? 'N/A' : last.toFixed(2)
  })()

  const overall = useMemo(() => {
    const crit = health.filter((s) => s.status === 'critical')

    const deg = health.filter((s) => s.status === 'degraded')

    const missing = health.filter((s) => s.status === 'missing')

    if (crit.length > 0) {
      const names = crit
        .slice(0, 2)
        .map((s) => s.name)
        .join(', ')

      return {
        state: 'critical' as ServiceStatus,
        headline:
          crit.length === 1
            ? '1 endpoint is down'
            : `${crit.length} endpoints are critical`,
        detail: `Affected: ${names}${
          crit.length > 2 ? ` +${crit.length - 2} more` : ''
        }`,
      }
    }

    if (deg.length > 0) {
      const names = deg
        .slice(0, 2)
        .map((s) => s.name)
        .join(', ')

      return {
        state: 'degraded' as ServiceStatus,
        headline:
          deg.length === 1
            ? '1 endpoint is degraded'
            : `${deg.length} endpoints are degraded`,
        detail: `${names}${
          deg.length > 2 ? ` +${deg.length - 2} more` : ''
        } below full availability`,
      }
    }

    if (health.length > 0 && missing.length === health.length) {
      return {
        state: 'missing' as ServiceStatus,
        headline: 'Results unavailable',
        detail: `No availability reported for ${health.length} endpoint${
          health.length === 1 ? '' : 's'
        }`,
      }
    }

    return {
      state: 'healthy' as ServiceStatus,
      headline: 'All systems operational',
      detail: `${health.length} endpoint${
        health.length === 1 ? '' : 's'
      } healthy${
        weekAvgValue !== null
          ? ` · ${weekAvgValue}% availability this week`
          : ''
      }`,
    }
  }, [health, weekAvgValue])

  const groupDowntimes = useMemo(() => {
    if (!downtimesData?.length || endpoints.length === 0) {
      return []
    }

    const keys = new Set(
      endpoints.map((ep) =>
        `${stripIdSuffix(ep.name)}|${ep.service}`.toLowerCase(),
      ),
    )

    return downtimesData.filter((d) =>
      (d.services ?? []).some((s) =>
        keys.has(`${stripIdSuffix(s.hostname)}|${s.service}`.toLowerCase()),
      ),
    )
  }, [downtimesData, endpoints])

  const { activeDowntimes, completedDowntimes, upcomingDowntimes } = useMemo(
    () => categorizeDowntimes(groupDowntimes),
    [groupDowntimes],
  )

  const bannerIncidents = useMemo(() => {
    const target = groupName.trim().toLowerCase()
    return getBannerIncidents(incidentsData).filter((incident) =>
      (incident.services ?? []).some(
        (s) => s.name.trim().toLowerCase() === target,
      ),
    )
  }, [incidentsData, groupName])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return endpoints.filter((ep) => {
      const h = healthByKey.get(ep.key) ?? 'missing'

      if (filter === 'healthy' && h !== 'healthy') {
        return false
      }

      if (filter === 'problem' && h === 'healthy') {
        return false
      }

      if (!q) return true

      return ep.name.toLowerCase().includes(q)
    })
  }, [filter, search, endpoints, healthByKey])

  const filterTabs: {
    id: FilterId
    label: string
    count: number | null
  }[] = [
    {
      id: 'all',
      label: 'All',
      count: endpoints.length,
    },
    {
      id: 'problem',
      label: 'Has problems',
      count: null,
    },
    {
      id: 'healthy',
      label: 'Healthy',
      count: null,
    },
  ]

  const b = BANNER_STYLES[overall.state]
  const BannerIcon = b.icon

  const showEndpointsLoading =
    Boolean(endpointsLoading || statusEndpointsLoading) &&
    !endpointsError &&
    !statusEndpointsError &&
    Boolean(group)

  const failingChecksCount = latestProblems?.data?.length ?? 0
  const showFailingChecksLink =
    Boolean(latestProblems) && !latestProblems?.error && failingChecksCount > 0

  return (
    <div className="page-container">
      <div className="flex flex-col mb-2">
        <button
          type="button"
          onClick={onBack}
          className="self-start inline-flex items-center gap-1 rounded px-1 py-0.5 text-sm text-brand transition-colors hover:text-brand-strong hover:underline -ml-2 cursor-pointer"
        >
          <ArrowLeft className="size-3.5 flex-shrink-0" strokeWidth={2} />
          Return to dashboard: {tenantName}
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <PageHeader
            title={
              <span className="inline-flex items-center gap-x-2.5 flex-wrap">
                <span>{group?.name ?? groupName}</span>
              </span>
            }
            className="items-start"
          />

          <div className="flex flex-col items-end gap-1 sm:shrink-0 self-center">
            <span className="text-[15px] font-medium text-body">
              Selected report:{' '}
              <strong className="text-muted">{selectedReport}</strong>
            </span>
          </div>
        </div>
      </div>

      {detailsLoading && !group ? (
        <div className="loading-container">
          <LoadingSpinner size="md" />
        </div>
      ) : detailsError ? (
        <div className="my-12">
          <ErrorDisplay
            error={detailsError}
            context={`the ${groupName} group`}
          />
        </div>
      ) : !group ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white px-12 py-4 mt-6 text-center shadow-sm">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-brand-subtle">
            <Info className="h-6 w-6 text-brand" />
          </div>

          <h3 className="mb-1 text-lg font-medium text-neutral-900">
            Group not found
          </h3>

          <p className="max-w-sm text-sm text-neutral-500">
            "{groupName}" reported no results for the "
            {selectedReport || 'selected'}" report. Pick another report, or go
            back to the dashboard.
          </p>
        </div>
      ) : (
        <>
          <div
            className={`flex flex-wrap items-center gap-3 rounded-xl border px-5 py-2 ${b.border} ${b.bg}`}
          >
            <BannerIcon
              className={`h-5 w-5 flex-shrink-0 ${b.headline}`}
              strokeWidth={2}
            />

            <div className="min-w-0 flex-1">
              <span className={`text-[14px] font-semibold ${b.headline}`}>
                {overall.headline}
              </span>

              <span className={`mx-1 ${b.meta}`}>·</span>

              <span className={`text-[13px] ${b.detail}`}>
                {overall.detail}
              </span>
            </div>

            {showFailingChecksLink && (
              <button
                type="button"
                onClick={openProblems}
                aria-haspopup="dialog"
                aria-expanded={problemsOpen}
                className={`inline-flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${b.headline}`}
              >
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                {failingChecksCount} failing check
                {failingChecksCount === 1 ? '' : 's'}
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </div>

          <IncidentBanner
            incidents={bannerIncidents}
            isLoading={incidentsLoading}
            error={incidentsError}
            tenantId={tenantId}
            canManage={canManageIncidents}
          />

          {!downtimesError &&
            !downtimesLoading &&
            groupDowntimes.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border px-5 py-2 bg-gray-50 text-gray-600 ring-gray-500/20">
                <WrenchScrewdriverIcon className="w-4 h-4" />

                <div className="min-w-0 flex-1">
                  <span className="text-[14px] font-semibold">
                    {groupDowntimes.length === 1
                      ? '1 downtime today'
                      : `${groupDowntimes.length} downtimes today`}
                  </span>

                  <DowntimeTypeSection group="active" items={activeDowntimes} />

                  <DowntimeTypeSection
                    group="upcoming"
                    items={upcomingDowntimes}
                  />

                  <DowntimeTypeSection
                    group="completed"
                    items={completedDowntimes}
                  />
                </div>
              </div>
            )}

          <div className="mt-2 mb-6 flex flex-wrap items-center rounded-md border border-neutral-200 bg-white px-1 py-2">
            <NowItem icon={Activity} label="Group status">
              {statusLoading ? (
                <span className="text-[11px] text-neutral-500">Loading…</span>
              ) : statusError ? (
                <span className="text-[11px] text-amber-700">unavailable</span>
              ) : (
                <>
                  <span
                    className={`h-2 w-2 rounded-full ${STATUS_STYLES[status].dot}`}
                  />

                  <span className={STATUS_STYLES[status].text}>
                    {STATUS_STYLES[status].label}
                  </span>
                </>
              )}
            </NowItem>

            <NowItem icon={Server} label="Endpoints">
              <span>{endpoints.length}</span>

              <span className="text-[11px] font-normal text-neutral-500">
                <span className="text-emerald-600">{counts.healthy}</span>·
                <span className="text-amber-600">{counts.degraded}</span>·
                <span className="text-red-600">{counts.critical}</span>·
                <span className="text-gray-500">{counts.missing}</span>
              </span>
            </NowItem>

            {latestProblems && (
              <NowItem
                icon={AlertTriangle}
                label="Failing checks"
                onClick={openProblems}
                title="Show latest failing checks for this group"
              >
                {latestProblems.error ? (
                  <span className="text-neutral-400">—</span>
                ) : latestProblems.isLoading && !latestProblems.data ? (
                  <span className="text-neutral-400">…</span>
                ) : (
                  <>
                    <span
                      className={
                        failingChecksCount > 0
                          ? 'text-red-700'
                          : 'text-emerald-700'
                      }
                    >
                      {failingChecksCount}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 self-center text-[11px] font-medium group-hover:underline ${
                        failingChecksCount > 0
                          ? 'text-red-700'
                          : 'text-neutral-500'
                      }`}
                    >
                      {failingChecksCount > 0 && (
                        <span
                          className="relative flex h-2 w-2"
                          aria-hidden="true"
                        >
                          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                      )}
                      View
                    </span>
                  </>
                )}
              </NowItem>
            )}

            <NowItem icon={ShieldCheck} label="Availability today" last>
              <span>{todayAvail}</span>

              {todayAvail !== 'N/A' && todayAvail !== '—' && (
                <span className="text-[11px] font-normal text-neutral-500">
                  %
                </span>
              )}
            </NowItem>
          </div>

          <SectionLabel>This week</SectionLabel>

          <section className="mb-6 rounded-xl border border-neutral-200 bg-white px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-medium">
                {group.name} availability
              </h2>

              <span className="text-xs text-neutral-500">
                last {groupDaily.length} day
                {groupDaily.length === 1 ? '' : 's'} · reported for the group
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] md:items-center gap-4 md:gap-6 lg:gap-12 xl:gap-24">
              <div
                className="grid h-[110px] items-end gap-2 sm:gap-3 md:gap-4 lg:gap-8 xl:gap-16"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(
                    groupDaily.length,
                    1,
                  )}, minmax(40px, 120px))`,
                }}
              >
                {groupDaily.map((v, i) => (
                  <WeekBar
                    key={group.dates[i] ?? i}
                    value={v}
                    day={formatShortDay(group.dates[i])}
                    fullDate={formatShortDate(group.dates[i])}
                  />
                ))}
              </div>

              <div className="md:text-right">
                <p className="text-xs text-neutral-500">
                  {groupDaily.length}-day average
                </p>

                <p className="mt-0.5 text-[32px] font-medium leading-none tabular-nums">
                  {weekAvg}

                  {weekAvgValue !== null && (
                    <span className="text-base text-neutral-400">%</span>
                  )}
                </p>
              </div>
            </div>
          </section>

          <SectionLabel>All endpoints</SectionLabel>

          <section className="rounded-xl border border-neutral-200 bg-white px-5 py-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[15px] font-medium">Endpoint breakdown</h2>

                {(endpointsError || statusEndpointsError) && (
                  <span className="text-[11px] text-amber-700">
                    endpoint details unavailable
                  </span>
                )}
              </div>

              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Search endpoints…"
                maxWidth="max-w-[200px]"
                className="mb-0"
              />
            </div>

            <div className="mb-1 flex items-center justify-between border-b border-neutral-200">
              <div className="flex gap-1">
                {filterTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFilter(t.id)}
                    className={`-mb-px border-b-2 px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                      filter === t.id
                        ? 'border-neutral-900 text-neutral-900'
                        : 'border-transparent text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {t.label}

                    {t.count !== null && (
                      <span className="ml-1 text-neutral-400">{t.count}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <table className="mt-3 w-full table-fixed text-sm">
              <thead>
                <tr className="text-[11px] font-medium uppercase tracking-[0.04em] text-neutral-400">
                  <th className="w-[30%] border-b border-neutral-200 px-1.5 py-2 text-left">
                    Endpoint
                  </th>

                  <th className="w-[18%] border-b border-neutral-200 px-1.5 py-2 text-left">
                    Status
                  </th>

                  <th className="w-[18%] border-b border-neutral-200 px-1.5 py-2 text-left">
                    Avail (Week)
                  </th>

                  <th className="w-[34%] border-b border-neutral-200 px-1.5 py-2 text-left">
                    Per Day
                  </th>
                </tr>

                {showEndpointsLoading && (
                  <tr>
                    <th colSpan={4}>
                      <LoadingBar active={showEndpointsLoading} />
                    </th>
                  </tr>
                )}
              </thead>

              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-1.5 py-6 text-center text-neutral-400"
                    >
                      {endpoints.length === 0
                        ? 'No endpoint results reported for this group'
                        : 'No endpoints match'}
                    </td>
                  </tr>
                )}

                {filtered.map((ep) => {
                  const epAvg = avgValid(ep.daily)

                  const epSt =
                    STATUS_STYLES[healthByKey.get(ep.key) ?? 'missing']

                  return (
                    <tr
                      key={ep.key}
                      ref={(el) => {
                        rowRefs.current[ep.key] = el
                      }}
                      className={
                        ep.key === focusKey
                          ? 'bg-brand-subtle ring-1 ring-inset ring-brand/40'
                          : undefined
                      }
                    >
                      <td className="border-b border-neutral-100 px-1.5 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <HardDriveIcon
                            className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400"
                            strokeWidth={2}
                          />

                          <span
                            className={`h-2 w-2 flex-shrink-0 rounded-full ${epSt.dot}`}
                          />

                          <span
                            className="truncate text-neutral-700"
                            title={`${ep.name} (${ep.service})`}
                          >
                            {stripIdSuffix(ep.name)}
                          </span>
                        </div>
                      </td>

                      <td className="border-b border-neutral-100 px-1.5 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${epSt.pill}`}
                        >
                          {epSt.label}
                        </span>
                      </td>

                      <td className="border-b border-neutral-100 px-1.5 py-2.5 tabular-nums text-neutral-700">
                        {epAvg === null ? 'N/A' : `${epAvg.toFixed(2)}%`}
                      </td>

                      <td className="border-b border-neutral-100 px-1.5 py-2.5">
                        <MiniBars daily={ep.daily} dates={group.dates} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      {latestProblems && (
        <LatestProblemsDrawer
          open={problemsOpen}
          onClose={closeProblems}
          problems={latestProblems.data}
          isLoading={latestProblems.isLoading}
          error={latestProblems.error}
          updatedAt={latestProblems.updatedAt}
          reportName={selectedReport}
          onEndpointSelect={
            onEndpointFocus ? handleProblemEndpointSelect : undefined
          }
          getMetricHref={latestProblems.getMetricHref}
        />
      )}
    </div>
  )
}

export default GroupDashboard
