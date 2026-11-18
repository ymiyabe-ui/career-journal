import { useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { MIN_PASSPHRASE } from '../lib/crypto'
import { useMemos } from '../memoStore'
import { useJournal } from '../store'
import { Button } from './ui'

const INPUT =
  'block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 pr-11 text-base placeholder:text-stone-400 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:placeholder:text-stone-600'

function PassInput({
  value,
  onChange,
  label,
  autoFocus,
}: {
  value: string
  onChange(v: string): void
  label: string
  autoFocus?: boolean
}) {
  const [shown, setShown] = useState(false)
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <span className="relative block">
        <input
          type={shown ? 'text' : 'password'}
          autoComplete="new-password"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          className={INPUT}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={shown ? '合言葉を隠す' : '合言葉を表示する'}
          onClick={() => setShown((s) => !s)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-500"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  )
}

/** まだどの端末でも合言葉を決めていないとき */
export function MemoSetupForm() {
  const create = useMemos((s) => s.create)
  const serverChecked = useMemos((s) => s.serverChecked)
  const syncOn = useJournal((s) => s.syncConfig !== null)
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)

  const tooShort = p1.length > 0 && p1.length < MIN_PASSPHRASE
  const mismatch = p2.length > 0 && p1 !== p2
  const ok = p1.length >= MIN_PASSPHRASE && p1 === p2

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ok || busy) return
        setBusy(true)
        try {
          await create(p1)
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-sm text-stone-600 dark:text-stone-400">
        仕事のことも日常のことも、思いついたときに1行ずつ残せます。メモは合言葉で暗号化してから保存・同期するので、同期先のスプレッドシートには読めない文字列だけが残ります。
      </p>
      <ul className="list-disc space-y-1 pl-5 text-xs text-stone-500 dark:text-stone-400">
        <li>同期の合言葉とは別のものにしてください（{MIN_PASSPHRASE}文字以上）</li>
        <li>合言葉はどこにも保存・送信しません。忘れるとメモは読めなくなります（達成・学びの記録は消えません）</li>
        <li>ほかの端末では、ここで決めた合言葉を1回だけ入れます</li>
      </ul>
      {syncOn && !serverChecked && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          ほかの端末ですでに合言葉を決めている場合は、ここで決めずに同期が終わるのを待ってください。同期が済むと、決めてある合言葉を入れる画面に変わります。
        </p>
      )}
      <PassInput label="合言葉" value={p1} onChange={setP1} />
      {tooShort && (
        <p className="-mt-2 text-xs text-red-600 dark:text-red-400">{MIN_PASSPHRASE}文字以上にしてください</p>
      )}
      <PassInput label="もう一度" value={p2} onChange={setP2} />
      {mismatch && <p className="-mt-2 text-xs text-red-600 dark:text-red-400">1回目と違います</p>}
      <Button type="submit" disabled={!ok || busy}>
        <KeyRound className="size-4" />
        {busy ? '鍵を作っています…' : '合言葉を決める'}
      </Button>
    </form>
  )
}

/**
 * 決めてある合言葉を入れるとき。
 * conflict のときは、別の端末で先に決めた合言葉に合わせる（この端末のメモは暗号化し直す）
 */
export function MemoUnlockForm({ conflict = false }: { conflict?: boolean }) {
  const unlock = useMemos((s) => s.unlock)
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!pass || busy) return
        setBusy(true)
        setError(null)
        try {
          if (!(await unlock(pass))) setError('合言葉が違います')
          else setPass('')
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-sm text-stone-600 dark:text-stone-400">
        {conflict
          ? '別の端末で先に決めた合言葉があります。その合言葉を入れると、この端末で書いたメモもその合言葉で暗号化し直して同期します。それまで、この端末のメモは同期しません。'
          : 'メモを読み書きするには、決めてある合言葉を入れてください（この端末で1回だけ）。'}
      </p>
      <PassInput label="合言葉" value={pass} onChange={setPass} />
      {error && <p className="-mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      <Button type="submit" disabled={!pass || busy}>
        <KeyRound className="size-4" />
        {busy ? '確かめています…' : '合言葉を入れる'}
      </Button>
    </form>
  )
}
