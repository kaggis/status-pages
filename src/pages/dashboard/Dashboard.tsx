import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  Fragment,
  type ReactNode,
} from 'react'
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowUpRightFromSquare,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  HardDriveIcon,
  Info,
  Server,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorDisplay from '@/components/ErrorDisplay'
import SearchInput from '@/components/SearchInput'
import SelectDropdown from '@/components/SelectDropdown'
import type { GroupResultsResponse, GroupStatusResponse } from '@/types/data'
import type { LatestMetricData } from '@/types/latestProblems'
import type { Downtime } from '@/types/downtimes'
import type { Incident } from '@/types/incidents'
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { categorizeDowntimes, fmtDowntimeDailyRange } from '@/utils/downtimes'
import { getBannerIncidents } from '@/utils/incidents'
import { formatDateTime } from '@/utils/formatDateTime'
import { buildReportOptions } from '@/utils/reportVisibilityOptions'
import type { EndpointResultsResponse } from '@/types/results'
import type { StatusNode } from '@/types/statusTimeline'
import { stripIdSuffix } from '@/utils/cleanup'
import IncidentBanner from './IncidentBanner'
import LatestProblemsDrawer from './LatestProblemsDrawer'

const WEEK_DAY_COUNT = 7

// List styles for each downtime type section
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

// Inline component that creates a downtime pill
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

// Inline component that creates a downtime section
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

// groups of available downtype types
type DowntimeGroup = 'active' | 'upcoming' | 'completed'

type ServiceStatus = 'healthy' | 'degraded' | 'critical' | 'missing'

interface EndpointSource {
  key: string
  name: string
  service: string
  byDate: Map<string, number>
}

interface EndpointRow {
  key: string
  name: string
  service: string
  status: ServiceStatus
  daily: number[]
}

interface Service {
  name: string
  status: ServiceStatus
  daily: number[]
  dailyDates: string[]
  endpoints: EndpointRow[]
}

type FilterId = 'all' | 'problem' | 'healthy'

const mapStatusValue = (value: string): ServiceStatus => {
  const v = value?.toUpperCase()
  if (v === 'CRITICAL' || v === 'DOWN') return 'critical'
  if (v === 'WARNING' || v === 'DEGRADED') return 'degraded'
  if (!v || v === 'UNKNOWN' || v === 'MISSING') return 'missing'
  return 'healthy'
}

const worstStatus = (values: string[]): ServiceStatus => {
  if (values.length === 0) return 'missing'
  const mapped = values.map(mapStatusValue)
  if (mapped.includes('critical')) return 'critical'
  if (mapped.includes('degraded')) return 'degraded'
  if (mapped.every((s) => s === 'missing')) return 'missing'
  return 'healthy'
}

const formatShortDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short' })

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })

// TODO: This will be replaced by an efficient backend call
const uptimeTone = (pct: number) => {
  if (pct >= 99.99) return 'bg-emerald-500'
  if (pct >= 98) return 'bg-amber-500'
  return 'bg-red-500'
}

const STATUS_STYLES: Record<
  ServiceStatus,
  { dot: string; pill: string; text: string; label: string }
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
    label: 'Degraded',
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

type BannerStatus = 'healthy' | 'degraded' | 'critical' | 'missing'

const BANNER_STYLES: Record<
  BannerStatus,
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

const avgValid = (arr: number[]): number | null => {
  const valid = arr.filter((v) => v >= 0)
  return valid.length === 0
    ? null
    : valid.reduce((a, b) => a + b, 0) / valid.length
}

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

// Create a full week display with the last of the week being today
const buildWeekAxis = (reported: Set<string>): string[] => {
  const today = new Date().toISOString().slice(0, 10)
  return [
    ...new Set([...lastNDates(today, WEEK_DAY_COUNT), ...reported]),
  ].sort()
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

const SectionLabel = ({ children }: { children: ReactNode }) => {
  return (
    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">
      {children}
    </p>
  )
}

// Loading bar identifies that we have resources (endpoints) that are currently loading
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

const MiniBars = ({ daily, dates }: { daily: number[]; dates: string[] }) => {
  return (
    <div
      className="grid gap-[2px]"
      style={{
        gridTemplateColumns: `repeat(${Math.max(daily.length, 1)}, minmax(0, 1fr))`,
      }}
    >
      {daily.map((p, i) => (
        <div
          key={i}
          className={`tooltip tooltip-top h-[18px] rounded-[2px] cursor-pointer opacity-90 hover:opacity-100 hover:scale-y-110 transition-all ${p === -1 ? 'bg-neutral-200' : uptimeTone(p)}`}
          data-tip={`${dates[i] ? formatShortDate(dates[i]) : ''}: ${p === -1 ? 'N/A' : `${p.toFixed(2)}%`}`}
        />
      ))}
    </div>
  )
}

interface PublicDashboardLinkProps {
  tenantName: string
  selectedReport: string
  className?: string
}

const PublicDashboardLink = ({
  tenantName,
  selectedReport,
  className,
}: PublicDashboardLinkProps) => (
  <a
    href={`/public/tenants/${encodeURIComponent(tenantName)}/dashboard?report=${encodeURIComponent(selectedReport)}`}
    target="_blank"
    rel="noopener noreferrer"
    className={`self-start inline-flex items-center gap-0.5 text-sm text-brand no-underline transition-colors hover:text-brand-strong hover:underline ${className ?? ''}`}
  >
    View public dashboard
    <ArrowUpRightFromSquare className="size-3 flex-shrink-0" />
  </a>
)

export interface DashboardProps {
  tenantName: string
  tenantId?: string
  reports: Array<{ name: string; public?: boolean }> | undefined
  reportsLoading: boolean
  reportsError: Error | null
  downtimesData?: Downtime[]
  downtimesLoading?: boolean
  downtimesError?: Error | null
  incidentsData?: Incident[]
  incidentsLoading?: boolean
  incidentsError?: Error | null
  canManageIncidents?: boolean
  resultsData: GroupResultsResponse | undefined
  resultsLoading: boolean
  resultsError: Error | null
  endpointsData?: EndpointResultsResponse
  endpointsLoading?: boolean
  endpointsError?: Error | null
  endpointStatusData?: StatusNode[]
  endpointStatusLoading?: boolean
  endpointStatusError?: Error | null
  /** Latest failing checks. When omitted, the counter, banner link and drawer are hidden. */
  latestProblems?: {
    data: LatestMetricData[] | undefined
    isLoading: boolean
    error: Error | null
    updatedAt?: number
    /** Status-timeline deep link for a check (mode-specific, built by the container) */
    getMetricHref?: (check: LatestMetricData) => string
  }
  statusData: GroupStatusResponse | undefined
  statusLoading: boolean
  statusError: Error | null
  selectedReport: string
  onReportChange: (name: string) => void
  onGroupSelect?: (groupName: string) => void
  onEndpointSelect?: (groupName: string, endpointName: string) => void
}

const Dashboard = ({
  tenantName,
  tenantId,
  reports,
  reportsLoading,
  reportsError,
  downtimesData,
  downtimesLoading,
  downtimesError,
  incidentsData,
  incidentsLoading,
  incidentsError,
  canManageIncidents,
  resultsData,
  resultsLoading,
  resultsError,
  endpointsData,
  endpointsLoading,
  endpointsError,
  endpointStatusData,
  endpointStatusLoading,
  endpointStatusError,
  latestProblems,
  statusData,
  statusLoading,
  statusError,
  selectedReport,
  onReportChange,
  onGroupSelect,
  onEndpointSelect,
}: DashboardProps) => {
  const [filter, setFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [problemsOpen, setProblemsOpen] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openProblems = useCallback(() => setProblemsOpen(true), [])
  const closeProblems = useCallback(() => setProblemsOpen(false), [])

  const handleProblemEndpointSelect = useCallback(
    (groupName: string, endpointName: string) => {
      setProblemsOpen(false)
      onEndpointSelect?.(groupName, endpointName)
    },
    [onEndpointSelect],
  )

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const handleCopyTenantId = () => {
    if (!tenantId) return
    void navigator.clipboard?.writeText(tenantId)
    setCopied(true)
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500)
  }

  const toggleGroup = (name: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const endpointsByGroup = useMemo(() => {
    const map = new Map<string, EndpointSource[]>()

    endpointsData?.results?.forEach((group) => {
      const rows: EndpointSource[] = []

      group['service-types']?.forEach((st) => {
        st.endpoints?.forEach((ep) => {
          const byDate = new Map<string, number>()
          ep.results?.forEach((r) => {
            const value = Number(r.availability)
            byDate.set(
              r.timestamp.slice(0, 10),
              Number.isFinite(value) ? value : -1,
            )
          })
          rows.push({
            key: `${group.name}|${st.name}|${ep.name}`,
            name: ep.name,
            service: st.name,
            byDate,
          })
        })
      })

      if (rows.length > 0) map.set(group.name, rows)
    })

    return map
  }, [endpointsData])

  const endpointStatusesByName = useMemo(() => {
    const map = new Map<string, ServiceStatus>()

    endpointStatusData?.forEach((endpoint) => {
      const latestStatus = endpoint.statuses
        ?.filter((status) => Boolean(status.timestamp) && Boolean(status.value))
        .reduce<(typeof endpoint.statuses)[number] | undefined>(
          (latest, current) => {
            if (!latest) return current

            return new Date(current.timestamp).getTime() >
              new Date(latest.timestamp).getTime()
              ? current
              : latest
          },
          undefined,
        )

      map.set(
        endpoint.name,
        latestStatus ? mapStatusValue(latestStatus.value) : 'missing',
      )
    })

    return map
  }, [endpointStatusData])

  const services = useMemo<Service[]>(() => {
    if (!resultsData?.data) return []

    const statusByName = new Map<string, string[]>()
    statusData?.data?.forEach((g) => {
      statusByName.set(
        g.name,
        g.results.map((r) => r.value),
      )
    })

    const reported = new Set<string>()
    resultsData.data.forEach((g) =>
      g.results.forEach((r) => reported.add(r.date.slice(0, 10))),
    )
    const dailyDates = buildWeekAxis(reported)

    return resultsData.data.map((g) => {
      const byDate = new Map<string, number>()
      g.results.forEach((r) => {
        const value = Number(r.availability)
        byDate.set(r.date.slice(0, 10), Number.isFinite(value) ? value : -1)
      })

      const daily = dailyDates.map((d) => byDate.get(d) ?? -1)
      const weekAvg = avgValid(daily.filter(Number.isFinite))
      const feedStatus = worstStatus(statusByName.get(g.name) ?? [])

      const endpoints: EndpointRow[] = (endpointsByGroup.get(g.name) ?? []).map(
        (ep) => {
          const epDaily = dailyDates.map((d) => ep.byDate.get(d) ?? -1)
          return {
            key: ep.key,
            name: ep.name,
            service: ep.service,
            status: endpointStatusesByName.get(ep.name) ?? 'missing',
            daily: epDaily,
          }
        },
      )

      return {
        name: g.name,
        status: weekAvg == null ? 'missing' : feedStatus,
        daily,
        dailyDates,
        endpoints,
      }
    })
  }, [resultsData, statusData, endpointsByGroup, endpointStatusesByName])

  const counts = useMemo<Record<ServiceStatus, number>>(() => {
    const c = { healthy: 0, degraded: 0, critical: 0, missing: 0 }
    services.forEach((s) => c[s.status]++)
    return c
  }, [services])

  const { tenantDaily, tenantDailyDates } = useMemo(() => {
    if (services.length === 0) {
      const emptyDates = buildWeekAxis(new Set())
      return {
        tenantDaily: emptyDates.map((): null => null),
        tenantDailyDates: emptyDates,
      }
    }
    const dates = services[0].dailyDates
    const dailyAvgs: (number | null)[] = dates.map((_, i) =>
      avgValid(services.map((s) => s.daily[i]).filter(Number.isFinite)),
    )
    return { tenantDaily: dailyAvgs, tenantDailyDates: dates }
  }, [services])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return services
      .filter((s) => {
        if (filter === 'healthy') return s.status === 'healthy'
        if (filter === 'problem') return s.status !== 'healthy'
        return true
      })
      .map((s) => {
        if (!q) return s
        if (s.name.toLowerCase().includes(q)) return s
        const matches = s.endpoints.filter((e) =>
          e.name.toLowerCase().includes(q),
        )
        return matches.length > 0 ? { ...s, endpoints: matches } : null
      })
      .filter((s): s is Service => s !== null)
  }, [filter, search, services])

  // groups that have endpoints and can be collapsed/extended
  const collapsibleGroups = useMemo(
    () => filtered.filter((s) => s.endpoints.length > 0).map((s) => s.name),
    [filtered],
  )

  const allCollapsed =
    collapsibleGroups.length > 0 &&
    collapsibleGroups.every((n) => collapsedGroups.has(n))

  const toggleAllGroups = () =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      collapsibleGroups.forEach((n) =>
        allCollapsed ? next.delete(n) : next.add(n),
      )
      return next
    })

  const weekAvgValue = useMemo<number | null>(() => {
    const valid = tenantDaily.filter((v): v is number => v !== null)
    if (valid.length === 0) return null
    return valid.reduce((a, b) => a + b, 0) / valid.length
  }, [tenantDaily])
  const weekAvg = weekAvgValue === null ? 'N/A' : weekAvgValue.toFixed(2)

  const todayAvail = (() => {
    if (tenantDaily.length === 0) return '—'
    const last = tenantDaily[tenantDaily.length - 1]
    return last === null ? 'N/A' : last.toFixed(2)
  })()

  const overall = useMemo<{
    state: BannerStatus
    headline: string
    detail: string
  }>(() => {
    const crit = services.filter((s) => s.status === 'critical')
    const deg = services.filter((s) => s.status === 'degraded')
    const missing = services.filter((s) => s.status === 'missing')

    if (crit.length > 0) {
      const names = crit
        .slice(0, 2)
        .map((s) => s.name)
        .join(', ')
      return {
        state: 'critical',
        headline:
          crit.length === 1
            ? '1 service is down'
            : `${crit.length} services are critical`,
        detail: `Affected: ${names}${crit.length > 2 ? ` +${crit.length - 2} more` : ''}`,
      }
    }
    if (deg.length > 0) {
      const names = deg
        .slice(0, 2)
        .map((s) => s.name)
        .join(', ')
      return {
        state: 'degraded',
        headline:
          deg.length === 1
            ? '1 service is degraded'
            : `${deg.length} services are degraded`,
        detail: `${names}${deg.length > 2 ? ` +${deg.length - 2} more` : ''} reporting elevated errors or latency`,
      }
    }
    if (services.length > 0 && missing.length === services.length) {
      return {
        state: 'missing',
        headline: 'Status unavailable',
        detail: `No status data reported for ${services.length} service${services.length === 1 ? '' : 's'}`,
      }
    }
    return {
      state: 'healthy',
      headline: 'All systems operational',
      detail: `${services.length} services healthy${weekAvgValue !== null ? ` · ${weekAvg}% uptime this week` : ''}`,
    }
  }, [services, weekAvg, weekAvgValue])

  const b = BANNER_STYLES[overall.state]
  const BannerIcon = b.icon
  const isLoading = reportsLoading || resultsLoading || statusLoading
  const error = reportsError || resultsError || statusError

  // check if endpoints are loading to display the loading bar
  const showEndpointsLoading =
    Boolean(endpointsLoading || endpointStatusLoading) &&
    !endpointsError &&
    !endpointStatusError &&
    services.length > 0

  let errorContext = 'dashboard metrics'
  if (reportsError) errorContext = 'tenant reports'
  else if (statusError) errorContext = 'current status'
  else if (resultsError) errorContext = 'daily results'

  const hasMultipleReports = (reports?.length ?? 0) > 1
  const isPublicReport =
    reports?.find((r) => r.name === selectedReport)?.public === true

  const filterTabs: { id: FilterId; label: string; count: number | null }[] = [
    { id: 'all', label: 'All', count: services.length },
    { id: 'problem', label: 'Has problems', count: null },
    { id: 'healthy', label: 'Healthy', count: null },
  ]

  const noData =
    !reportsLoading &&
    (!reports?.length ||
      (!resultsData?.data?.length && !statusData?.data?.length))

  const { activeDowntimes, completedDowntimes, upcomingDowntimes } = useMemo(
    () => categorizeDowntimes(downtimesData),
    [downtimesData],
  )

  const bannerIncidents = useMemo(
    () => getBannerIncidents(incidentsData),
    [incidentsData],
  )

  const failingChecksCount = latestProblems?.data?.length ?? 0
  const showFailingChecksLink =
    Boolean(latestProblems) && !latestProblems?.error && failingChecksCount > 0

  return (
    <div className="page-container">
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <PageHeader
            title="Dashboard"
            subtitle={
              tenantName ? (
                <span className="inline-flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                  <span>
                    Overview for <strong>{tenantName}</strong>
                    {reports?.length === 1 && selectedReport && (
                      <>
                        {' · '}
                        <strong>{selectedReport}</strong> report
                      </>
                    )}
                  </span>
                  {tenantId && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-subtle">
                      <span title={tenantId}>{tenantId}</span>
                      <button
                        type="button"
                        onClick={handleCopyTenantId}
                        className={`flex-shrink-0 rounded p-0.5 transition-colors ${
                          copied
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'text-subtle hover:bg-surface-strong hover:text-body'
                        }`}
                        aria-label={copied ? 'Copied' : 'Copy tenant ID'}
                        title={copied ? 'Copied!' : 'Copy tenant ID'}
                      >
                        {copied ? (
                          <Check className="h-3 w-3" strokeWidth={2.5} />
                        ) : (
                          <Copy className="h-3 w-3" strokeWidth={2} />
                        )}
                      </button>
                    </span>
                  )}
                </span>
              ) : undefined
            }
            className="items-start"
          />
          {hasMultipleReports && (
            <div className="flex flex-col items-stretch gap-1 sm:shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-body">
                  Select a report:
                </span>
                <SelectDropdown
                  value={selectedReport}
                  onChange={onReportChange}
                  options={buildReportOptions(reports)}
                  className="w-[220px]"
                />
              </div>
              {isPublicReport && (
                <PublicDashboardLink
                  tenantName={tenantName}
                  selectedReport={selectedReport}
                  className="sm:self-end"
                />
              )}
            </div>
          )}
          {reports?.length === 1 && isPublicReport && (
            <div className="flex flex-col items-end gap-1 sm:shrink-0 self-center">
              <span className="text-[15px] font-medium text-body">
                Selected report:{' '}
                <strong className="text-muted">{selectedReport}</strong>
              </span>
              <PublicDashboardLink
                tenantName={tenantName}
                selectedReport={selectedReport}
                className="sm:self-end"
              />
            </div>
          )}
        </div>
      </div>

      {isLoading && !resultsData ? (
        <div className="loading-container">
          <LoadingSpinner size="md" />
        </div>
      ) : error ? (
        <div className="my-12">
          <ErrorDisplay error={error} context={errorContext} />
        </div>
      ) : noData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white px-12 py-4 mt-6 text-center shadow-sm">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-brand-subtle">
            <Info className="h-6 w-6 text-brand" />
          </div>
          <h3 className="mb-1 text-lg font-medium text-neutral-900">
            No data available for the selected report
          </h3>
          <p className="max-w-sm text-sm text-neutral-500">
            There is no status or result data available for the "
            {selectedReport || 'selected'}" report yet.
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
          {/* Display incidents banner if any non-closed incidents exist */}
          <IncidentBanner
            incidents={bannerIncidents}
            isLoading={incidentsLoading}
            error={incidentsError}
            tenantId={tenantId}
            canManage={canManageIncidents}
          />
          {/* Display downtimes banner if downtimes exist for today */}
          {!downtimesError &&
            !downtimesLoading &&
            downtimesData &&
            downtimesData.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border px-5 py-2 bg-gray-50 text-gray-600 ring-gray-500/20">
                <WrenchScrewdriverIcon className="w-4 h-4" />
                <div className="min-w-0 flex-1">
                  <span className="text-[14px] font-semibold">
                    {downtimesData.length === 1
                      ? '1 downtime today'
                      : `${downtimesData.length} downtimes today`}
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
            <NowItem icon={Activity} label="Tenant status">
              <span
                className={`h-2 w-2 rounded-full ${STATUS_STYLES[overall.state].dot}`}
              />
              <span className={STATUS_STYLES[overall.state].text}>
                {STATUS_STYLES[overall.state].label}
              </span>
            </NowItem>
            <NowItem icon={Server} label="Services">
              <span>{services.length}</span>
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
                title="Show latest failing checks"
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
                Tenant-wide availability
              </h2>
              <span className="text-xs text-neutral-500">
                last {tenantDaily.length} day
                {tenantDaily.length === 1 ? '' : 's'} · all services averaged
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] md:items-center gap-4 md:gap-6 lg:gap-12 xl:gap-24">
              <div
                className="grid h-[110px] items-end gap-2 sm:gap-3 md:gap-4 lg:gap-8 xl:gap-16"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(tenantDaily.length, 1)}, minmax(40px, 120px))`,
                }}
              >
                {tenantDaily.map((v, i) => (
                  <WeekBar
                    key={tenantDailyDates[i] ?? i}
                    value={v}
                    day={formatShortDay(tenantDailyDates[i])}
                    fullDate={formatShortDate(tenantDailyDates[i])}
                  />
                ))}
              </div>

              <div className="md:text-right">
                <p className="text-xs text-neutral-500">
                  {tenantDaily.length}-day average
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

          <SectionLabel>All services</SectionLabel>
          <section className="rounded-xl border border-neutral-200 bg-white px-5 py-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[15px] font-medium">Service breakdown</h2>
                <span>
                  <button
                    type="button"
                    onClick={toggleAllGroups}
                    disabled={collapsibleGroups.length === 0}
                    className="mb-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {allCollapsed ? (
                      <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : (
                      <ChevronsDownUp className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                    {allCollapsed ? 'Expand all' : 'Collapse all'}
                  </button>
                </span>
                {(endpointsError || endpointStatusError) && (
                  <span className="text-[11px] text-amber-700">
                    endpoint details unavailable
                  </span>
                )}
              </div>
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Search services…"
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
                    Service
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
                      {' '}
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
                      No services match
                    </td>
                  </tr>
                )}
                {filtered.map((service) => {
                  const st = STATUS_STYLES[service.status]
                  const serviceWeekAvg = avgValid(
                    service.daily.filter(Number.isFinite),
                  )
                  const hasEndpoints = service.endpoints.length > 0
                  const isCollapsed = collapsedGroups.has(service.name)

                  return (
                    <Fragment key={service.name}>
                      <tr>
                        <td className="border-b border-neutral-100 px-1.5 py-2.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {hasEndpoints ? (
                              <button
                                type="button"
                                onClick={() => toggleGroup(service.name)}
                                aria-expanded={!isCollapsed}
                                aria-label={
                                  isCollapsed
                                    ? `Show endpoints for ${service.name}`
                                    : `Hide endpoints for ${service.name}`
                                }
                                className="flex-shrink-0 rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                              >
                                {isCollapsed ? (
                                  <ChevronRight
                                    className="h-3.5 w-3.5"
                                    strokeWidth={2}
                                  />
                                ) : (
                                  <ChevronDown
                                    className="h-3.5 w-3.5"
                                    strokeWidth={2}
                                  />
                                )}
                              </button>
                            ) : (
                              <span className="w-[18px] flex-shrink-0" />
                            )}
                            <span
                              className={`h-2 w-2 flex-shrink-0 rounded-full ${st.dot}`}
                            />
                            {onGroupSelect ? (
                              <button
                                type="button"
                                onClick={() => onGroupSelect(service.name)}
                                title={`Open ${service.name}`}
                                className="min-w-0 truncate rounded text-left font-medium text-neutral-800 transition-colors hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 cursor-pointer"
                              >
                                {service.name}
                              </button>
                            ) : (
                              <span className="truncate font-medium text-neutral-800">
                                {service.name}
                              </span>
                            )}
                            {hasEndpoints && (
                              <span className="flex-shrink-0 text-[11px] text-neutral-400">
                                {service.endpoints.length}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="border-b border-neutral-100 px-1.5 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${st.pill}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="border-b border-neutral-100 px-1.5 py-2.5 tabular-nums text-neutral-700">
                          {serviceWeekAvg === null
                            ? 'N/A'
                            : `${serviceWeekAvg.toFixed(2)}%`}
                        </td>
                        <td className="border-b border-neutral-100 px-1.5 py-2.5">
                          <MiniBars
                            daily={service.daily}
                            dates={service.dailyDates}
                          />
                        </td>
                      </tr>

                      {!isCollapsed &&
                        service.endpoints.map((ep) => {
                          const epAvg = avgValid(
                            ep.daily.filter(Number.isFinite),
                          )
                          const epSt = STATUS_STYLES[ep.status]
                          return (
                            <tr key={ep.key} className="bg-neutral-50/50">
                              <td className="border-b border-neutral-100 py-2.5 pl-8 pr-1.5">
                                <div className="flex min-w-0 items-center gap-2">
                                  <HardDriveIcon
                                    className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400"
                                    strokeWidth={2}
                                  />
                                  <span
                                    className={`h-2 w-2 flex-shrink-0 rounded-full ${epSt.dot}`}
                                  />
                                  {onEndpointSelect ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onEndpointSelect(service.name, ep.name)
                                      }
                                      title={`Open ${ep.name} (${ep.service}) in ${service.name}`}
                                      className="min-w-0 truncate rounded text-left text-neutral-700 transition-colors hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 cursor-pointer"
                                    >
                                      {stripIdSuffix(ep.name)}
                                    </button>
                                  ) : (
                                    <span
                                      className="truncate text-neutral-700"
                                      title={`${ep.name} (${ep.service})`}
                                    >
                                      {stripIdSuffix(ep.name)}
                                    </span>
                                  )}
                                  <span className="flex-shrink-0 text-[11px] text-neutral-400">
                                    {ep.service}
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
                                {epAvg === null
                                  ? 'N/A'
                                  : `${epAvg.toFixed(2)}%`}
                              </td>
                              <td className="border-b border-neutral-100 px-1.5 py-2.5">
                                <MiniBars
                                  daily={ep.daily}
                                  dates={service.dailyDates}
                                />
                              </td>
                            </tr>
                          )
                        })}
                    </Fragment>
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
            onEndpointSelect ? handleProblemEndpointSelect : undefined
          }
          getMetricHref={latestProblems.getMetricHref}
        />
      )}
    </div>
  )
}

export default Dashboard
