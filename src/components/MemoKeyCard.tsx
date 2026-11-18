import { Lock } from 'lucide-react'
import { useMemos } from '../memoStore'
import { Button, Card } from './ui'

/** 設定タブの「メモの暗号化」 */
export function MemoKeyCard() {
  const keyState = useMemos((s) => s.keyState)
  const conflict = useMemos((s) => s.conflict)
  const lock = useMemos((s) => s.lock)
  const forget = useMemos((s) => s.forget)

  const status =
    keyState === 'ready'
      ? conflict
        ? 'この端末の合言葉が、別の端末で先に決めた合言葉と違います。「今日」タブのメモから、先に決めたほうの合言葉を入れてください。'
        : 'この端末では合言葉を入れてあります。'
      : keyState === 'unlock'
        ? 'この端末ではまだ合言葉を入れていません。「今日」タブのメモから入れられます。'
        : 'まだ合言葉を決めていません。「今日」タブのメモから決められます。'

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-1.5 font-bold">
        <Lock className="size-4" />
        メモの暗号化
      </h2>
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
        メモ（仕事・日常）は、合言葉で暗号化してからこの端末と同期先に保存します。同期先のスプレッドシートには読めない文字列だけが残り、合言葉はどこにも保存・送信しません。日付と時刻だけは暗号化しません（同期に使うため）。
      </p>
      <p className="text-sm">{status}</p>
      {keyState === 'ready' && (
        <Button
          variant="ghost"
          className="mt-2 -ml-2"
          onClick={() => {
            if (confirm('この端末の鍵を消しますか？メモは残り、合言葉を入れ直せば読めます')) void lock()
          }}
        >
          この端末の鍵を消す
        </Button>
      )}
      {keyState === 'unlock' && (
        <>
          <p className="mt-3 text-xs text-stone-500">
            合言葉を忘れたときは、メモは戻せません。同期先の鍵とメモを先に消してから（手順は gas/README.md）、ここでこの端末のメモを消して決め直します。達成・学びの記録は消えません。
          </p>
          <Button
            variant="danger"
            className="mt-2 -ml-2"
            onClick={() => {
              if (confirm('この端末のメモを全部消しますか？元に戻せません（達成・学びの記録は消えません）')) void forget()
            }}
          >
            合言葉を忘れたとき：この端末のメモを消す
          </Button>
        </>
      )}
    </Card>
  )
}
