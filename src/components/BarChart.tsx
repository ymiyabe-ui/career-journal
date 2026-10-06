export interface Bar {
  label: string
  value: number
  /** 棒の上に出す文字 */
  text: string
  /** 読み上げ・ホバー用の説明 */
  title: string
  /** まだ終わっていない期間は薄く塗る */
  partial?: boolean
}

/** 軸を持たない簡素な棒グラフ。棒の上に値を直接書く */
export function BarChart({ bars, max }: { bars: Bar[]; max: number }) {
  const top = Math.max(max, 1)
  return (
    <ol className="flex h-36 items-end gap-1.5" aria-label="棒グラフ">
      {bars.map((b) => (
        <li key={b.label} title={b.title} className="flex h-full min-w-0 flex-1 flex-col justify-end">
          <span className="mb-0.5 text-center text-[11px] leading-none font-semibold tabular-nums text-stone-600 dark:text-stone-300">
            {b.text}
          </span>
          <div
            className={`w-full rounded-t-md bg-accent ${b.partial ? 'opacity-50' : ''}`}
            style={{ height: `${Math.max((b.value / top) * 100, b.value > 0 ? 3 : 0)}%` }}
            role="img"
            aria-label={b.title}
          />
          <span className="mt-1 h-3 text-center text-[11px] leading-none whitespace-nowrap text-stone-500 dark:text-stone-400">
            {b.label}
          </span>
        </li>
      ))}
    </ol>
  )
}
