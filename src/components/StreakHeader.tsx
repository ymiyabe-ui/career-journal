import { Flame, Ticket } from 'lucide-react'
import { nextStreakMilestone } from '../lib/badges'
import { useJournal } from '../store'
import type { Stats } from '../types'

/** 「あと◯日で…」の予告。次のバッジまでの近さに合わせて言い方を変える */
function milestoneHint(stats: Stats, thresholds: number[]): string | null {
  const next = nextStreakMilestone(stats.currentStreak, thresholds)
  if (!next) return null
  const need = next.threshold - stats.currentStreak
  if (need === 1) {
    return stats.todayDone ? `明日も書くと「${next.label}」` : `今日書くと「${next.label}」`
  }
  return `あと${need}日で「${next.label}」`
}

function statusHint(stats: Stats): string {
  const { currentStreak, todayDone, restPending, totalEntries } = stats
  if (todayDone) return '今日の分は記録済み'
  if (restPending > 0) return `お休み券で${restPending}日ぶんを埋めます。今日書けば連続がつながります`
  if (currentStreak > 0) return '今日書けば連続がつながります'
  return totalEntries > 0 ? '今日からまた積み上げよう' : '今日から始めよう'
}

export function StreakHeader({ stats }: { stats: Stats }) {
  const { currentStreak, todayDone, restTickets } = stats
  const thresholds = useJournal((s) => s.settings.streakMilestones)
  const milestone = milestoneHint(stats, thresholds)

  return (
    <header className="flex items-center gap-4 px-1 pt-6 pb-4">
      <div
        className={`flex size-16 shrink-0 items-center justify-center rounded-2xl ${
          todayDone ? 'bg-accent text-white dark:text-stone-950' : 'bg-accent-soft text-accent'
        }`}
      >
        <Flame className="size-9" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 pr-8">
        <p className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
          連続記録
          {restTickets > 0 && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent-strong"
              title="1日休んでも連続が切れないお休み券"
            >
              <Ticket className="size-3" />
              お休み券 ×{restTickets}
            </span>
          )}
        </p>
        <p className="leading-none">
          <span className="text-5xl font-bold tabular-nums">{currentStreak}</span>
          <span className="ml-1 text-lg font-semibold">日</span>
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{statusHint(stats)}</p>
        {milestone && <p className="mt-0.5 text-xs font-semibold text-accent-strong">{milestone}</p>}
      </div>
    </header>
  )
}

export function StatRow({ stats }: { stats: Stats }) {
  const items = [
    { label: '累計', value: stats.totalEntries },
    { label: '今月', value: stats.monthEntries },
    { label: '最長', value: stats.longestStreak },
  ]
  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl bg-white px-3 py-2 text-center shadow-sm dark:bg-stone-900"
        >
          <dt className="text-xs text-stone-500 dark:text-stone-400">{it.label}</dt>
          <dd className="text-xl font-bold tabular-nums">
            {it.value}
            <span className="ml-0.5 text-xs font-medium">日</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
