import { useMemo, useState } from 'react'
import { Copy, Download } from 'lucide-react'
import { Button, Card } from '../components/ui'
import { copyText, saveTextFile } from '../lib/download'
import { isFilled } from '../lib/stats'
import { buildSummary, PERIODS, resolvePeriod, type PeriodId } from '../lib/summary'
import { loadPref, savePref } from '../lib/theme'
import { useMemos } from '../memoStore'
import { useFields, useJournal } from '../store'

const WITH_MEMOS_KEY = 'cj-summary-memos'

export function SummaryView() {
  const entries = useJournal((s) => s.entries)
  const today = useJournal((s) => s.today)
  const fields = useFields()
  const [period, setPeriod] = useState<PeriodId>('last30')
  const [message, setMessage] = useState<string | null>(null)
  const memos = useMemos((s) => s.memos)
  const memosReady = useMemos((s) => s.keyState === 'ready')
  const [withMemos, setWithMemos] = useState(() => loadPref(WITH_MEMOS_KEY, '0') === '1')

  const markdown = useMemo(() => {
    const list = Object.values(entries)
    const earliest = list
      .filter(isFilled)
      .map((e) => e.date)
      .sort()[0]
    const memoList = withMemos && memosReady ? Object.values(memos) : []
    return buildSummary(list, fields, resolvePeriod(period, today, earliest), memoList)
  }, [entries, today, period, fields, withMemos, memosReady, memos])

  const choose = (id: PeriodId) => {
    setPeriod(id)
    setMessage(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={period === p.id}
            onClick={() => choose(p.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              period === p.id
                ? 'bg-accent text-white dark:text-stone-950'
                : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {memosReady && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-accent)]"
            checked={withMemos}
            onChange={(e) => {
              setWithMemos(e.target.checked)
              savePref(WITH_MEMOS_KEY, e.target.checked ? '1' : '0')
              setMessage(null)
            }}
          />
          メモも入れる
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={async () => setMessage((await copyText(markdown)) ? 'コピーしました' : 'コピーできませんでした')}
        >
          <Copy className="size-4" />
          Markdownをコピー
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            saveTextFile(`career-journal-summary-${today.replaceAll('-', '')}.md`, markdown, 'text/markdown')
            setMessage('ファイルに保存しました')
          }}
        >
          <Download className="size-4" />
          .mdで保存
        </Button>
      </div>
      {message && <p className="text-sm font-medium text-accent" role="status">{message}</p>}

      <Card>
        <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap break-words">{markdown}</pre>
      </Card>
    </div>
  )
}
