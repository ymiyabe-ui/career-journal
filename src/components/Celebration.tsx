import { useEffect, useState } from 'react'
import { Flame, PencilLine } from 'lucide-react'

export interface CelebrationInfo {
  kind: 'created' | 'updated'
  streak: number
  /** 今日以外の日の記録か */
  backfill: boolean
}

/** 記録したあとに一瞬だけ出る祝福表示。タップで閉じる */
export function Celebration({ info, onDone }: { info: CelebrationInfo; onDone(): void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), info.kind === 'created' ? 1900 : 1100)
    const t2 = setTimeout(onDone, info.kind === 'created' ? 2200 : 1400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [info, onDone])

  const title =
    info.kind === 'updated' ? '更新しました' : info.backfill ? '記録を足しました' : '今日も記録した！'

  return (
    <div
      role="status"
      onClick={onDone}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 backdrop-blur-[2px] ${
        leaving ? 'animate-fade-out' : ''
      }`}
    >
      <div className="animate-pop-in mx-6 flex flex-col items-center rounded-3xl bg-white px-10 py-8 shadow-xl dark:bg-stone-900">
        <div className="flex size-16 items-center justify-center rounded-full bg-accent text-white dark:text-stone-950">
          {info.kind === 'updated' ? (
            <PencilLine className="size-8" />
          ) : (
            <Flame className="size-9" />
          )}
        </div>
        <p className="mt-4 text-xl font-bold">{title}</p>
        {info.kind === 'created' && info.streak > 0 && (
          <p className="mt-1 text-stone-600 dark:text-stone-300">
            連続 <span className="text-2xl font-bold text-accent tabular-nums">{info.streak}</span> 日
          </p>
        )}
      </div>
    </div>
  )
}
