import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, BookOpen, CalendarDays, PenLine, Settings } from 'lucide-react'
import { Celebration, type CelebrationInfo } from './components/Celebration'
import { StatRow, StreakHeader } from './components/StreakHeader'
import { SyncBadge } from './components/SyncBadge'
import { DAY_START_HOUR } from './config/fields'
import { computeBadges, earnedIds } from './lib/badges'
import { computeStats } from './lib/stats'
import { requestPersistence } from './storage/dexie'
import { useJournal } from './store'
import { BadgesView } from './views/BadgesView'
import { HistoryView } from './views/HistoryView'
import { ReviewView } from './views/ReviewView'
import { SettingsView } from './views/SettingsView'
import { TodayView } from './views/TodayView'

type Tab = 'today' | 'history' | 'review' | 'badges' | 'settings'

const TABS: { id: Tab; label: string; icon: typeof PenLine }[] = [
  { id: 'today', label: '今日', icon: PenLine },
  { id: 'history', label: '記録', icon: BookOpen },
  { id: 'review', label: '振り返り', icon: CalendarDays },
  { id: 'badges', label: 'バッジ', icon: Award },
  { id: 'settings', label: '設定', icon: Settings },
]

export default function App() {
  const { entries, loaded, today, load, refreshToday, save, sync } = useJournal()
  const [tab, setTab] = useState<Tab>('today')
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    void load()
    void requestPersistence().then(setPersisted)
  }, [load])

  // 開きっぱなしで日付をまたいだときに「今日」を進める。画面に戻ったときと電波が戻ったときに同期する
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      refreshToday()
      void sync()
    }
    const onOnline = () => void sync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    const timer = setInterval(refreshToday, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      clearInterval(timer)
    }
  }, [refreshToday, sync])

  const stats = useMemo(
    () => computeStats(Object.values(entries), today, DAY_START_HOUR),
    [entries, today],
  )

  const handleSave = useCallback(
    async (date: string, values: Record<string, string>) => {
      const snapshot = (state: ReturnType<typeof useJournal.getState>) => {
        const list = Object.values(state.entries)
        return {
          stats: computeStats(list, state.today, DAY_START_HOUR),
          earned: earnedIds(computeBadges(list, state.today, DAY_START_HOUR)),
        }
      }
      const before = snapshot(useJournal.getState())
      const kind = await save(date, values)
      const state = useJournal.getState()
      const after = snapshot(state)
      const badges = computeBadges(Object.values(state.entries), state.today, DAY_START_HOUR).filter(
        (b) => b.earnedOn && !before.earned.has(b.id) && after.earned.has(b.id),
      )
      setCelebration({
        kind,
        streak: after.stats.currentStreak,
        backfill: date !== state.today,
        badges,
        usedTicket: after.stats.restUsed > before.stats.restUsed,
      })
    },
    [save],
  )

  const closeCelebration = useCallback(() => setCelebration(null), [])

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-28">
      <div className="relative">
        <StreakHeader stats={stats} />
        <SyncBadge onClick={() => setTab('settings')} />
      </div>
      {tab === 'today' && (
        <div className="mb-4">
          <StatRow stats={stats} />
        </div>
      )}

      <main>
        {!loaded ? null : tab === 'today' ? (
          <TodayView onSave={handleSave} />
        ) : tab === 'history' ? (
          <HistoryView onSave={handleSave} />
        ) : tab === 'review' ? (
          <ReviewView onSave={handleSave} />
        ) : tab === 'badges' ? (
          <BadgesView />
        ) : (
          <SettingsView persisted={persisted} />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                tab === id ? 'text-accent' : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {celebration && <Celebration info={celebration} onDone={closeCelebration} />}
    </div>
  )
}
