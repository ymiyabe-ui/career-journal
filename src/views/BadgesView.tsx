import { useMemo } from 'react'
import { Award, Lock, Ticket } from 'lucide-react'
import { Card } from '../components/ui'
import { DAY_START_HOUR } from '../config/fields'
import { REST_TICKET_EVERY, REST_TICKET_MAX } from '../config/milestones'
import { computeBadges } from '../lib/badges'
import { formatDateJa } from '../lib/date'
import { computeStats } from '../lib/stats'
import { useJournal } from '../store'
import type { Badge } from '../types'

export function BadgesView() {
  const entries = useJournal((s) => s.entries)
  const today = useJournal((s) => s.today)

  const { badges, stats } = useMemo(() => {
    const list = Object.values(entries)
    return {
      badges: computeBadges(list, today, DAY_START_HOUR),
      stats: computeStats(list, today, DAY_START_HOUR),
    }
  }, [entries, today])

  return (
    <div className="space-y-4">
      <Section
        title="連続記録"
        badges={badges.filter((b) => b.kind === 'streak')}
        remaining={(b) => b.threshold - stats.longestStreak}
      />
      <Section
        title="累計の記録日数"
        note="連続が切れても残ります"
        badges={badges.filter((b) => b.kind === 'total')}
        remaining={(b) => b.threshold - stats.totalEntries}
      />
      <Card>
        <h2 className="mb-1 flex items-center gap-1.5 font-bold">
          <Ticket className="size-4 text-accent" />
          お休み券
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          連続{REST_TICKET_EVERY}日ごとに1枚もらえます（最大{REST_TICKET_MAX}枚）。1日休んだ日は、次に記録したときに自動で使って連続をつなぎます。休んだ日数より券が足りないと、連続は1日からになります。累計とバッジは消えません。
        </p>
        <p className="mt-2 text-sm font-semibold">
          いま持っている券：{stats.restTickets}枚
          {stats.restPending > 0 && `（休み中の${stats.restPending}日ぶんは使用予定）`}
        </p>
      </Card>
    </div>
  )
}

function Section({
  title,
  note,
  badges,
  remaining,
}: {
  title: string
  note?: string
  badges: Badge[]
  remaining(b: Badge): number
}) {
  return (
    <Card>
      <h2 className="font-bold">{title}</h2>
      {note && <p className="text-xs text-stone-500 dark:text-stone-400">{note}</p>}
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {badges.map((b) => (
          <li
            key={b.id}
            className={`flex flex-col items-center rounded-xl px-2 py-3 text-center ${
              b.earnedOn
                ? 'bg-accent-soft text-accent-strong'
                : 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500'
            }`}
          >
            {b.earnedOn ? <Award className="size-7" /> : <Lock className="size-6" />}
            <span className="mt-1 text-xs leading-tight font-bold">{b.label}</span>
            <span className="mt-0.5 text-[11px] leading-tight">
              {b.earnedOn ? formatDateJa(b.earnedOn) : `あと${Math.max(1, remaining(b))}日`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
