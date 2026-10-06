import { Flame } from 'lucide-react'
import type { Stats } from '../types'

export function StreakHeader({ stats }: { stats: Stats }) {
  const { currentStreak, todayDone } = stats
  const hint = todayDone
    ? '今日の分は記録済み'
    : currentStreak > 0
      ? '今日書けば連続がつながります'
      : stats.totalEntries > 0
        ? '今日からまた積み上げよう'
        : '今日から始めよう'

  return (
    <header className="flex items-center gap-4 px-1 pt-6 pb-4">
      <div
        className={`flex size-16 shrink-0 items-center justify-center rounded-2xl ${
          todayDone ? 'bg-accent text-white dark:text-stone-950' : 'bg-accent-soft text-accent'
        }`}
      >
        <Flame className="size-9" strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-stone-500 dark:text-stone-400">連続記録</p>
        <p className="leading-none">
          <span className="text-5xl font-bold tabular-nums">{currentStreak}</span>
          <span className="ml-1 text-lg font-semibold">日</span>
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{hint}</p>
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
