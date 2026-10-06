import { Cloud, CloudAlert, CloudOff, RefreshCw } from 'lucide-react'
import { useJournal } from '../store'

/** 右上の小さな同期の状態。問題があるときだけ色を付ける */
export function SyncBadge({ onClick }: { onClick(): void }) {
  const state = useJournal((s) => s.syncState)
  if (state === 'off') return null

  const view = {
    idle: { icon: Cloud, label: '同期済み', tone: 'text-stone-400 dark:text-stone-500' },
    syncing: { icon: RefreshCw, label: '同期中', tone: 'text-stone-400 animate-spin dark:text-stone-500' },
    offline: { icon: CloudOff, label: 'オフライン（あとで同期）', tone: 'text-stone-400 dark:text-stone-500' },
    error: { icon: CloudAlert, label: '同期できていません', tone: 'text-red-500' },
  }[state]
  const Icon = view.icon

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={view.label}
      title={view.label}
      className="absolute top-6 right-0 rounded-lg p-1.5 hover:bg-stone-200/60 dark:hover:bg-stone-800"
    >
      <Icon className={`size-5 ${view.tone}`} />
    </button>
  )
}
