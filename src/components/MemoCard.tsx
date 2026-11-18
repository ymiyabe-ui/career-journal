import { useMemo, useState, type KeyboardEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { ClipboardList, Copy, Lock, NotebookPen, Plus, Trash2 } from 'lucide-react'
import { MEMO_KINDS, MEMO_MARKS } from '../config/memo'
import { copyText } from '../lib/download'
import { loadPref, savePref } from '../lib/theme'
import { buildDailyReport, hasWorkMemos } from '../lib/report'
import { MEMO_MAX_LENGTH, useMemos, useMemosOn } from '../memoStore'
import { useJournal } from '../store'
import type { Memo, MemoBody, MemoKind, MemoMark } from '../types'
import { MemoSetupForm, MemoUnlockForm } from './MemoKeyForms'
import { Button, Card } from './ui'

const KIND_KEY = 'cj-memo-kind'

const TEXTAREA =
  'block w-full resize-none rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base leading-relaxed placeholder:text-stone-400 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:placeholder:text-stone-600'

const chip = (on: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium ${
    on ? 'bg-accent text-white dark:text-stone-950' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
  }`

const markLabel = (mark?: MemoMark) => MEMO_MARKS.find((m) => m.id === mark)?.label

interface Props {
  date: string
  /** 日報をコピーしたあとに、その日の振り返り（3項目）へ進む */
  onReflect?(): void
}

export function MemoCard({ date, onReflect }: Props) {
  const keyState = useMemos((s) => s.keyState)
  const conflict = useMemos((s) => s.conflict)
  const unreadable = useMemos((s) => s.unreadable)
  const unsupported = useJournal((s) => s.syncConfig !== null && s.memoSync?.status === 'unsupported')
  const memos = useMemosOn(date)

  if (keyState === 'loading') return null

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-bold">
          <NotebookPen className="size-4" />
          メモ
        </h2>
        <span className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
          <Lock className="size-3" />
          暗号化して保存
        </span>
      </div>

      {keyState === 'setup' && <MemoSetupForm />}
      {keyState === 'unlock' && <MemoUnlockForm />}
      {keyState === 'ready' && (
        <div className="space-y-4">
          {conflict && (
            <div className="rounded-xl border border-amber-300 p-3 dark:border-amber-800">
              <MemoUnlockForm conflict />
            </div>
          )}
          <MemoInput date={date} />
          {memos.length > 0 && (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {memos.map((m) => (
                <MemoItem key={m.id} memo={m} />
              ))}
            </ul>
          )}
          {hasWorkMemos(memos, date) && <DailyReport memos={memos} date={date} onReflect={onReflect} />}
          {unsupported && (
            <p className="text-xs text-stone-500">
              同期先が古い版のため、メモはこの端末にだけ保存しています。同期先（GAS）を新しい版にすると、ほかの端末にも届きます。
            </p>
          )}
          {unreadable > 0 && (
            <p className="text-xs text-stone-500">
              別の合言葉で書かれた、読めないメモが{unreadable}件あります。
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function KindAndMark({
  kind,
  mark,
  onKind,
  onMark,
}: {
  kind: MemoKind
  mark?: MemoMark
  onKind(k: MemoKind): void
  onMark(m: MemoMark | undefined): void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full bg-stone-100 p-0.5 dark:bg-stone-800">
        {MEMO_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={kind === k.id}
            onClick={() => onKind(k.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              kind === k.id ? 'bg-white shadow-sm dark:bg-stone-950' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      {kind === 'work' &&
        MEMO_MARKS.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mark === m.id}
            onClick={() => onMark(mark === m.id ? undefined : m.id)}
            className={chip(mark === m.id)}
          >
            {m.label}
          </button>
        ))}
    </div>
  )
}

function MemoInput({ date }: { date: string }) {
  const add = useMemos((s) => s.add)
  const [text, setText] = useState('')
  const [kind, setKind] = useState<MemoKind>(() => (loadPref(KIND_KEY, 'work') === 'life' ? 'life' : 'work'))
  const [mark, setMark] = useState<MemoMark | undefined>()

  const submit = async () => {
    if (!text.trim()) return
    const body: MemoBody = { text, kind, mark }
    setText('')
    setMark(undefined)
    await add(date, body)
  }

  // Enter で残す（変換中の Enter と Shift+Enter は改行）
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <KindAndMark
        kind={kind}
        mark={mark}
        onKind={(k) => {
          setKind(k)
          savePref(KIND_KEY, k)
        }}
        onMark={setMark}
      />
      <div className="flex gap-2">
        <textarea
          rows={1}
          value={text}
          maxLength={MEMO_MAX_LENGTH}
          placeholder={kind === 'work' ? '例：A社 初回面談、宿題2点' : '例：散歩で考えが整理できた'}
          aria-label="メモ"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className={`${TEXTAREA} field-sizing-content min-h-11`}
        />
        <Button type="submit" disabled={!text.trim()} aria-label="メモを残す" className="shrink-0 self-end px-3">
          <Plus className="size-5" />
        </Button>
      </div>
    </form>
  )
}

function MemoItem({ memo }: { memo: Memo }) {
  const update = useMemos((s) => s.update)
  const remove = useMemos((s) => s.remove)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(memo.text)
  const [kind, setKind] = useState<MemoKind>(memo.kind)
  const [mark, setMark] = useState<MemoMark | undefined>(memo.mark)

  const time = format(parseISO(memo.createdAt), 'HH:mm')

  if (editing) {
    return (
      <li className="space-y-2 py-3">
        <KindAndMark kind={kind} mark={mark} onKind={setKind} onMark={setMark} />
        <textarea
          rows={2}
          value={text}
          maxLength={MEMO_MAX_LENGTH}
          aria-label="メモを直す"
          autoFocus
          onChange={(e) => setText(e.target.value)}
          className={`${TEXTAREA} field-sizing-content`}
        />
        <div className="flex gap-2">
          <Button
            disabled={!text.trim()}
            onClick={async () => {
              await update(memo.id, { text, kind, mark })
              setEditing(false)
            }}
          >
            直す
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setText(memo.text)
              setKind(memo.kind)
              setMark(memo.mark)
              setEditing(false)
            }}
          >
            やめる
          </Button>
          <Button
            variant="danger"
            className="ml-auto"
            aria-label="メモを消す"
            onClick={() => {
              if (confirm('このメモを消しますか？')) void remove(memo.id)
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </li>
    )
  }

  const label = memo.kind === 'life' ? '日常' : markLabel(memo.mark)
  return (
    <li>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-full items-start gap-2.5 py-2.5 text-left"
      >
        <span className="w-10 shrink-0 pt-0.5 text-xs text-stone-400 tabular-nums">{time}</span>
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed">{memo.text}</span>
        {label && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              memo.kind === 'life'
                ? 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                : 'bg-accent-soft text-accent-strong'
            }`}
          >
            {label}
          </span>
        )}
      </button>
    </li>
  )
}

function DailyReport({ memos, date, onReflect }: { memos: Memo[]; date: string; onReflect?(): void }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<boolean | null>(null)
  const text = useMemo(() => buildDailyReport(memos, date), [memos, date])

  if (!open) {
    return (
      <Button variant="ghost" className="-ml-2" onClick={() => setOpen(true)}>
        <ClipboardList className="size-4" />
        日報にまとめる
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl bg-stone-50 p-3 dark:bg-stone-950">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">日報（仕事のメモから）</h3>
        <button type="button" className="text-xs text-stone-500 hover:underline" onClick={() => setOpen(false)}>
          閉じる
        </button>
      </div>
      <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap break-words">{text}</pre>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={async () => setCopied(await copyText(text))}>
          <Copy className="size-4" />
          コピー
        </Button>
        {copied && onReflect && (
          <Button variant="ghost" onClick={onReflect}>
            続けて今日の振り返りを書く
          </Button>
        )}
      </div>
      {copied !== null && (
        <p className="text-sm font-medium text-accent" role="status">
          {copied ? 'コピーしました。日報の欄に貼ってください' : 'コピーできませんでした'}
        </p>
      )}
    </div>
  )
}
