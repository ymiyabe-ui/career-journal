import { useMemo, useState } from 'react'
import { BarChart } from '../components/BarChart'
import { Card } from '../components/ui'
import { buckets, type Unit } from '../lib/trends'
import { useJournal } from '../store'

const UNITS: { id: Unit; label: string; span: string }[] = [
  { id: 'week', label: '週ごと', span: '直近8週' },
  { id: 'month', label: '月ごと', span: '直近6か月' },
]

export function TrendsView() {
  const entries = useJournal((s) => s.entries)
  const today = useJournal((s) => s.today)
  const [unit, setUnit] = useState<Unit>('week')

  const data = useMemo(() => buckets(Object.values(entries), today, unit), [entries, today, unit])
  const spanLabel = UNITS.find((u) => u.id === unit)!.span
  const unitWord = unit === 'week' ? '週' : '月'
  const done = data.filter((b) => !b.current)
  // 終わった期間だけで平均する（今週・今月は途中なので入れない）
  const avg = done.length > 0 ? Math.round((done.reduce((s, b) => s + b.rate, 0) / done.length) * 100) : null
  const currentWord = unit === 'week' ? '今週' : '今月'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
        {UNITS.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setUnit(u.id)}
            className={`rounded-lg py-2 text-sm font-medium ${
              unit === u.id ? 'bg-white shadow-sm dark:bg-stone-950' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            {u.label}
          </button>
        ))}
      </div>

      <Card>
        <h2 className="font-bold">記入率</h2>
        <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
          {spanLabel}。{unitWord}のうち記録した日の割合
          {avg !== null && `（終わった${unitWord}の平均 ${avg}%）`}
        </p>
        <BarChart
          max={1}
          bars={data.map((b) => ({
            label: b.label,
            value: b.rate,
            text: `${Math.round(b.rate * 100)}`,
            title: `${b.label}${unit === 'week' ? 'の週' : ''}：${b.recorded}日 / ${b.days}日（${Math.round(b.rate * 100)}%）`,
            partial: b.current,
          }))}
        />
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          数字は%。右端の薄い棒は、{currentWord}（今日まで）です。
        </p>
      </Card>

      <Card>
        <h2 className="font-bold">達成の数</h2>
        <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
          {spanLabel}。「今日の達成」に書いた行の数
        </p>
        <BarChart
          max={Math.max(...data.map((b) => b.wins))}
          bars={data.map((b) => ({
            label: b.label,
            value: b.wins,
            text: `${b.wins}`,
            title: `${b.label}${unit === 'week' ? 'の週' : ''}：達成 ${b.wins}件`,
            partial: b.current,
          }))}
        />
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          1行を1件として数えます。1日に複数書くと増えます。
        </p>
      </Card>
    </div>
  )
}
