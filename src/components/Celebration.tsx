import { useEffect, useState } from 'react'
import { Award, Flame, PencilLine, Ticket } from 'lucide-react'
import type { Badge } from '../types'

export interface CelebrationInfo {
  kind: 'created' | 'updated'
  streak: number
  /** 今日以外の日の記録か */
  backfill: boolean
  /** この記録で新しく獲得したバッジ */
  badges: Badge[]
  /** この記録でお休み券を使って連続をつないだか */
  usedTicket: boolean
}

/** 記録したあとに出る祝福表示。タップで閉じる。バッジを取ったときは長めに出す */
export function Celebration({ info, onDone }: { info: CelebrationInfo; onDone(): void }) {
  const [leaving, setLeaving] = useState(false)
  const hasBadge = info.badges.length > 0
  const ms = hasBadge ? 3800 : info.kind === 'created' ? 2200 : 1400

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), ms - 300)
    const t2 = setTimeout(onDone, ms)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [ms, onDone])

  const title = hasBadge
    ? 'バッジを獲得！'
    : info.kind === 'updated'
      ? '更新しました'
      : info.backfill
        ? '記録を足しました'
        : '今日も記録した！'

  return (
    <div
      role="status"
      onClick={onDone}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 backdrop-blur-[2px] ${
        leaving ? 'animate-fade-out' : ''
      }`}
    >
      <div className="animate-pop-in mx-6 flex max-w-xs flex-col items-center rounded-3xl bg-white px-8 py-8 text-center shadow-xl dark:bg-stone-900">
        <div
          className={`flex items-center justify-center rounded-full bg-accent text-white dark:text-stone-950 ${
            hasBadge ? 'size-20' : 'size-16'
          }`}
        >
          {hasBadge ? (
            <Award className="size-11" />
          ) : info.kind === 'updated' ? (
            <PencilLine className="size-8" />
          ) : (
            <Flame className="size-9" />
          )}
        </div>
        <p className="mt-4 text-xl font-bold">{title}</p>
        {info.badges.map((b) => (
          <p key={b.id} className="mt-1 text-lg font-bold text-accent-strong">
            「{b.label}」
          </p>
        ))}
        {info.kind === 'created' && info.streak > 0 && (
          <p className="mt-2 text-stone-600 dark:text-stone-300">
            連続 <span className="text-2xl font-bold text-accent tabular-nums">{info.streak}</span> 日
          </p>
        )}
        {info.usedTicket && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
            <Ticket className="size-3.5" />
            お休み券で連続を守りました
          </p>
        )}
      </div>
    </div>
  )
}
