import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HardDriveIcon,
  X,
} from 'lucide-react'
import SearchInput from '@/components/SearchInput'
import type { LatestMetricData } from '@/types/latestProblems'
import { stripIdSuffix } from '@/utils/cleanup'
import { formatDateTime } from '@/utils/formatDateTime'
import {
  PROBLEM_SEVERITIES,
  formatRelativeTime,
  getProblemSeverity,
  type ProblemSeverity,
} from '@/utils/latestProblems'

const SEVERITY_STYLES: Record<
  ProblemSeverity,
  { label: string; pill: string; dot: string; accent: string }
> = {
  critical: {
    label: 'Critical',
    pill: 'bg-red-50 text-red-700 ring-red-600/20',
    dot: 'bg-red-500',
    accent: 'border-l-red-500',
  },
  warning: {
    label: 'Warning',
    pill: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    dot: 'bg-amber-500',
    accent: 'border-l-amber-500',
  },
  unknown: {
    label: 'Unknown',
    pill: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
    dot: 'bg-neutral-400',
    accent: 'border-l-neutral-400',
  },
  missing: {
    label: 'Missing',
    pill: 'bg-gray-50 text-gray-600 ring-gray-500/20',
    dot: 'bg-gray-400',
    accent: 'border-l-gray-400',
  },
}

type SeverityFilter = ProblemSeverity | 'all'

const problemKey = (p: LatestMetricData) =>
  `${p.endpoint_group}|${p.service}|${p.endpoint}|${p.metric}|${p.timestamp}`

// Plain left-click navigates in place -> close the drawer.
// Cmd/Ctrl/Shift/middle-click opens a new tab -> keep the drawer open.
const isPlainLeftClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

export interface LatestProblemsDrawerProps {
  open: boolean
  onClose: () => void
  problems: LatestMetricData[] | undefined
  isLoading?: boolean
  error?: Error | null
  /** react-query dataUpdatedAt (ms) */
  updatedAt?: number
  reportName?: string
  onEndpointSelect?: (groupName: string, endpointName: string) => void
  /** Builds the status-timeline deep link for a check. When omitted, metric names are plain text. */
  getMetricHref?: (check: LatestMetricData) => string
}

const LatestProblemsDrawer = ({
  open,
  onClose,
  problems,
  isLoading,
  error,
  updatedAt,
  reportName,
  onEndpointSelect,
  getMetricHref,
}: LatestProblemsDrawerProps) => {
  const toggleId = useId()
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  const [severity, setSeverity] = useState<SeverityFilter>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(() => Date.now())

  // Keep relative times fresh while the drawer is open
  useEffect(() => {
    if (!open) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [open])

  // Esc to close + move focus into the drawer when it opens
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => closeRef.current?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const counts = useMemo(() => {
    const c: Record<ProblemSeverity, number> = {
      critical: 0,
      warning: 0,
      unknown: 0,
      missing: 0,
    }
    problems?.forEach((p) => {
      const s = getProblemSeverity(p.status)
      if (s) c[s]++
    })
    return c
  }, [problems])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (problems ?? []).filter((p) => {
      if (severity !== 'all' && getProblemSeverity(p.status) !== severity) {
        return false
      }
      if (!q) return true
      return [p.metric, p.endpoint, p.service, p.endpoint_group, p.summary]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    })
  }, [problems, severity, search])

  const total = problems?.length ?? 0

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const chips: {
    id: SeverityFilter
    label: string
    count: number
    dot?: string
  }[] = [
    { id: 'all', label: 'All', count: total },
    ...PROBLEM_SEVERITIES.filter((s) => counts[s] > 0).map((s) => ({
      id: s,
      label: SEVERITY_STYLES[s].label,
      count: counts[s],
      dot: SEVERITY_STYLES[s].dot,
    })),
  ]

  const renderBody = () => {
    if (isLoading && !problems) {
      return (
        <div className="space-y-2 p-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-neutral-100"
            />
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <p className="p-4 text-[13px] text-amber-700" title={error.message}>
          Latest check results are unavailable right now.
        </p>
      )
    }

    if (total === 0) {
      return (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <CheckCircle2
            className="h-8 w-8 text-emerald-600"
            strokeWidth={1.75}
          />
          <p className="text-[14px] font-medium text-neutral-800">
            No failing checks
          </p>
          <p className="text-[12px] text-neutral-500">
            Every metric's latest result is OK.
          </p>
        </div>
      )
    }

    if (filtered.length === 0) {
      return (
        <p className="px-4 py-10 text-center text-[13px] text-neutral-400">
          No checks match the current filters
        </p>
      )
    }

    return (
      <ul className="space-y-2 p-2">
        {filtered.map((p) => {
          const key = problemKey(p)
          const s = SEVERITY_STYLES[getProblemSeverity(p.status) ?? 'missing']
          const endpointLabel = stripIdSuffix(p.endpoint)
          const hasOutput = Boolean(p.message) && p.message !== p.summary
          const isExpanded = expanded.has(key)
          const metricHref = getMetricHref?.(p)

          return (
            <li
              key={key}
              className={`rounded-lg border border-l-4 border-neutral-200 bg-white p-3 transition-colors hover:border-neutral-300 ${s.accent}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.pill}`}
                >
                  {s.label}
                </span>
                <time
                  dateTime={p.timestamp}
                  title={formatDateTime(p.timestamp, {
                    seconds: true,
                    utcSuffix: true,
                  })}
                  className="whitespace-nowrap text-[11px] tabular-nums text-neutral-500"
                >
                  {formatRelativeTime(p.timestamp, now)}
                </time>
              </div>

              <div className="mt-1.5">
                {metricHref ? (
                  <Link
                    to={metricHref}
                    onClick={(e) => {
                      if (isPlainLeftClick(e)) onClose()
                    }}
                    title="Open this metric on the status timeline"
                    className="group/metric inline-flex max-w-full items-start gap-1 rounded font-mono text-[12.5px] text-neutral-900 no-underline transition-colors hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    <span className="break-all">{p.metric}</span>
                    <ArrowUpRight
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-neutral-400 transition-colors group-hover/metric:text-brand"
                      strokeWidth={2}
                    />
                  </Link>
                ) : (
                  <p className="break-all font-mono text-[12.5px] text-neutral-900">
                    {p.metric}
                  </p>
                )}
              </div>

              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px]">
                <HardDriveIcon
                  className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400"
                  strokeWidth={2}
                />
                {onEndpointSelect ? (
                  <button
                    type="button"
                    onClick={() =>
                      onEndpointSelect(p.endpoint_group, p.endpoint)
                    }
                    title={`Open ${p.endpoint} in ${p.endpoint_group}`}
                    className="min-w-0 cursor-pointer truncate rounded text-left font-medium text-neutral-800 hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    {endpointLabel}
                  </button>
                ) : (
                  <span
                    className="min-w-0 truncate font-medium text-neutral-800"
                    title={p.endpoint}
                  >
                    {endpointLabel}
                  </span>
                )}
                <span className="text-neutral-400">{p.service}</span>
                <span className="text-neutral-300">·</span>
                <span
                  className="min-w-0 truncate text-neutral-500"
                  title={p.endpoint_group}
                >
                  {p.endpoint_group}
                </span>
              </div>

              {p.summary && (
                <p
                  className="mt-1.5 line-clamp-2 text-[12px] text-neutral-600"
                  title={p.summary}
                >
                  {p.summary}
                </p>
              )}

              {hasOutput && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(key)}
                    aria-expanded={isExpanded}
                    className="mt-1.5 inline-flex cursor-pointer items-center gap-0.5 rounded text-[11px] text-neutral-500 hover:text-neutral-900"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" strokeWidth={2} />
                    ) : (
                      <ChevronRight className="h-3 w-3" strokeWidth={2} />
                    )}
                    {isExpanded ? 'Hide output' : 'Show output'}
                  </button>
                  {isExpanded && (
                    <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-neutral-50 p-2 font-mono text-[11px] leading-relaxed text-neutral-700">
                      {p.message}
                    </pre>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="drawer drawer-end">
      <input
        id={toggleId}
        type="checkbox"
        className="drawer-toggle"
        checked={open}
        onChange={(e) => {
          if (!e.target.checked) onClose()
        }}
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="drawer-content" />

      <div className="drawer-side z-50">
        <label
          htmlFor={toggleId}
          aria-label="Close failing checks"
          className="drawer-overlay"
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex h-full w-screen max-w-[520px] flex-col bg-neutral-50 shadow-xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="flex items-center gap-2 text-[16px] font-semibold text-neutral-900"
              >
                Failing checks
                {total > 0 && !error && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[12px] font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                    {total}
                  </span>
                )}
              </h2>
              <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                Latest result per metric · newest first
                {reportName && (
                  <>
                    {' · '}
                    <span className="font-medium text-neutral-700">
                      {reportName}
                    </span>{' '}
                    report
                  </>
                )}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="btn btn-ghost btn-sm btn-square"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </header>

          {total > 0 && !error && (
            <div className="space-y-2 border-b border-neutral-200 bg-white px-5 py-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Search check, endpoint, group…"
                maxWidth="max-w-full"
                className="mb-0"
              />
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label="Filter by status"
              >
                {chips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSeverity(c.id)}
                    aria-pressed={severity === c.id}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                      severity === c.id
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
                    }`}
                  >
                    {c.dot && (
                      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                    )}
                    {c.label}
                    <span
                      className={
                        severity === c.id
                          ? 'text-neutral-300'
                          : 'text-neutral-400'
                      }
                    >
                      {c.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">{renderBody()}</div>

          <footer className="border-t border-neutral-200 bg-white px-5 py-2 text-[11px] text-neutral-500">
            {updatedAt
              ? `Updated ${formatRelativeTime(new Date(updatedAt).toISOString(), now)} · refreshes every minute`
              : 'Refreshes every minute'}
          </footer>
        </aside>
      </div>
    </div>
  )
}

export default LatestProblemsDrawer
