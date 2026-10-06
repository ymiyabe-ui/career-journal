import { useState } from 'react'
import { DEFAULT_THRESHOLDS, streakLabel, totalLabel } from '../config/milestones'
import { MAX_THRESHOLDS, parseThresholds } from '../lib/settings'
import { useJournal } from '../store'
import { Button, Card } from './ui'

const INPUT =
  'block w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none dark:border-stone-700 dark:bg-stone-950'

export function MilestonesEditor() {
  const settings = useJournal((s) => s.settings)
  // 別の端末で変えた設定が同期で届いたら、入力欄も作り直す
  return <MilestonesForm key={settings.updatedAt} />
}

function MilestonesForm() {
  const settings = useJournal((s) => s.settings)
  const updateSettings = useJournal((s) => s.updateSettings)
  const [streak, setStreak] = useState(settings.streakMilestones.join(', '))
  const [total, setTotal] = useState(settings.totalMilestones.join(', '))
  const [saved, setSaved] = useState(false)

  const s = parseThresholds(streak)
  const t = parseThresholds(total)
  const unchanged =
    s.ok &&
    t.ok &&
    s.values.join() === settings.streakMilestones.join() &&
    t.values.join() === settings.totalMilestones.join()

  const save = () => {
    if (!s.ok || !t.ok) return
    void updateSettings((cur) => ({ ...cur, streakMilestones: s.values, totalMilestones: t.values }))
    setSaved(true)
  }

  const reset = () => {
    setStreak(DEFAULT_THRESHOLDS.streak.join(', '))
    setTotal(DEFAULT_THRESHOLDS.total.join(', '))
    setSaved(false)
  }

  return (
    <Card>
      <h2 className="mb-1 font-bold">バッジのしきい値</h2>
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
        何日でバッジをもらうかを、数字をカンマで区切って入れます（{MAX_THRESHOLDS}個まで）。スマホとPCで同じになります。
      </p>

      <Field
        label="連続記録（日）"
        value={streak}
        onChange={(v) => {
          setStreak(v)
          setSaved(false)
        }}
        result={s}
        names={(n) => streakLabel(n)}
      />
      <div className="h-3" />
      <Field
        label="累計の記録日数（日）"
        value={total}
        onChange={(v) => {
          setTotal(v)
          setSaved(false)
        }}
        result={t}
        names={(n) => totalLabel(n)}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={!s.ok || !t.ok || unchanged}>
          保存する
        </Button>
        <Button variant="ghost" onClick={reset}>
          初期値に戻す
        </Button>
        {saved && <span className="text-sm font-medium text-accent">保存しました</span>}
      </div>
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
  result,
  names,
}: {
  label: string
  value: string
  onChange(v: string): void
  result: ReturnType<typeof parseThresholds>
  names(n: number): string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        className={INPUT}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!result.ok}
      />
      <span
        className={`mt-1 block text-xs ${result.ok ? 'text-stone-500 dark:text-stone-400' : 'font-medium text-red-600 dark:text-red-400'}`}
      >
        {result.ok ? result.values.map(names).join('・') : result.error}
      </span>
    </label>
  )
}
