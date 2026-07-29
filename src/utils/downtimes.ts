import type { Downtime } from '@/types/downtimes'

// This is a formating function that takes a today's downtime timerange in iso8601 timestamps and produces a convenient
// string with start end like 12:35-16:55. If the downtime started before today it produces a ...-16:55 if extends it produces
// a 12:35-... string
export function fmtDowntimeDailyRange(start: string, end: string) {
  const fmt = (iso: string) => iso.slice(11, 16) // HH:MM in UTC
  const dateOf = (iso: string) => iso.slice(0, 10) // YYYY-MM-DD in UTC

  const today = new Date().toISOString().slice(0, 10)

  const startsBeforeToday = dateOf(start) < today
  const endsAfterToday = dateOf(end) > today

  const left = startsBeforeToday ? '...' : fmt(start)
  const right = endsAfterToday ? '...' : fmt(end)

  return `${left}-${right}`
}

// This is a function that takes a list of downtimes and categorizes them based on start/end timestamps to active, upcoming and completed
export function categoriseDowntimes(downtimes: Downtime[] | undefined) {
  const now = Date.now()

  const activeDowntimes: Downtime[] = []
  const upcomingDowntimes: Downtime[] = []
  const completedDowntimes: Downtime[] = []

  if (downtimes) {
    for (const d of downtimes) {
      const start = new Date(d.scheduled_at).getTime()
      const end = new Date(d.completed_at).getTime()

      if (now < start) {
        upcomingDowntimes.push(d)
      } else if (now >= start && now <= end) {
        activeDowntimes.push(d)
      } else {
        completedDowntimes.push(d)
      }
    }

    // sort items in each group list
    activeDowntimes.sort(
      (a, b) =>
        new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime(),
    )
    upcomingDowntimes.sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )
    completedDowntimes.sort(
      (a, b) =>
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
    )
  }

  return { activeDowntimes, upcomingDowntimes, completedDowntimes }
}
