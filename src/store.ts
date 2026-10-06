import { create } from 'zustand'
import { DAY_START_HOUR } from './config/fields'
import { logicalDate } from './lib/date'
import { pickNewer } from './lib/merge'
import { isFilled } from './lib/stats'
import { createDexieRepository } from './storage/dexie'
import { CURSOR_KEY, fetchTransport, runSync, SyncError, type SyncConfig } from './sync/sync'
import { SCHEMA_VERSION, type JournalEntry } from './types'

const repo = createDexieRepository()

const CONFIG_KEY = 'syncConfig'
const LAST_SYNCED_KEY = 'lastSyncedAt'

export type SaveResult = 'created' | 'updated'
export type SyncState = 'off' | 'idle' | 'syncing' | 'offline' | 'error'

interface JournalState {
  entries: Record<string, JournalEntry>
  loaded: boolean
  /** 記録の対象日としての「今日」。日付をまたいだら refreshToday で更新する */
  today: string
  syncConfig: SyncConfig | null
  syncState: SyncState
  syncMessage: string | null
  lastSyncedAt: string | null
  load(): Promise<void>
  refreshToday(): void
  save(date: string, fields: Record<string, string>): Promise<SaveResult>
  remove(date: string): Promise<void>
  /** 読み込んだ件数（上書きしたもの）を返す */
  importEntries(entries: JournalEntry[]): Promise<number>
  /** null で同期をやめる（端末の記録は残す） */
  setSyncConfig(config: SyncConfig | null): Promise<void>
  sync(): Promise<void>
}

// 同期中にもう一度呼ばれたら、終わったあとに1回だけやり直す
let running: Promise<void> | null = null
let again = false

export const useJournal = create<JournalState>((set, get) => {
  const putLocal = async (list: JournalEntry[]) => {
    await repo.putLocal(list)
    set((s) => ({ entries: { ...s.entries, ...Object.fromEntries(list.map((e) => [e.id, e])) } }))
    void get().sync()
  }

  const syncOnce = async () => {
    const config = get().syncConfig
    if (!config) return
    set({ syncState: 'syncing' })
    try {
      const { applied, rejected } = await runSync(repo, config, fetchTransport)
      const lastSyncedAt = new Date().toISOString()
      await repo.setMeta(LAST_SYNCED_KEY, lastSyncedAt)
      set((s) => ({
        entries: { ...s.entries, ...Object.fromEntries(applied.map((e) => [e.id, e])) },
        syncState: 'idle',
        syncMessage: rejected > 0 ? `${rejected}件は形が合わず同期できませんでした` : null,
        lastSyncedAt,
      }))
    } catch (e) {
      const offline = e instanceof SyncError && e.code === 'offline'
      set({
        syncState: offline ? 'offline' : 'error',
        syncMessage: e instanceof Error ? e.message : '同期に失敗しました',
      })
    }
  }

  return {
    entries: {},
    loaded: false,
    today: logicalDate(new Date(), DAY_START_HOUR),
    syncConfig: null,
    syncState: 'off',
    syncMessage: null,
    lastSyncedAt: null,

    async load() {
      const [list, syncConfig, lastSyncedAt] = await Promise.all([
        repo.list(),
        repo.getMeta<SyncConfig>(CONFIG_KEY),
        repo.getMeta<string>(LAST_SYNCED_KEY),
      ])
      set({
        entries: Object.fromEntries(list.map((e) => [e.id, e])),
        loaded: true,
        syncConfig: syncConfig ?? null,
        syncState: syncConfig ? 'idle' : 'off',
        lastSyncedAt: lastSyncedAt ?? null,
      })
      void get().sync()
    },

    refreshToday() {
      const today = logicalDate(new Date(), DAY_START_HOUR)
      if (today !== get().today) set({ today })
    },

    async save(date, fields) {
      const now = new Date().toISOString()
      const current = get().entries[date]
      const isNew = !isFilled(current)
      const entry: JournalEntry = {
        id: date,
        date,
        fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()])),
        // 削除した日に書き直したときは新しい記録として扱う（連続記録の判定は createdAt で行う）
        createdAt: isNew ? now : current.createdAt,
        updatedAt: now,
        schemaVersion: SCHEMA_VERSION,
      }
      await putLocal([entry])
      return isNew ? 'created' : 'updated'
    },

    async remove(date) {
      const current = get().entries[date]
      if (!current) return
      await putLocal([{ ...current, deleted: true, updatedAt: new Date().toISOString() }])
    },

    async importEntries(incoming) {
      const newer = pickNewer(get().entries, incoming)
      if (newer.length > 0) await putLocal(newer)
      return newer.length
    },

    async setSyncConfig(config) {
      await repo.setMeta(CONFIG_KEY, config)
      if (!config) {
        set({ syncConfig: null, syncState: 'off', syncMessage: null })
        return
      }
      // 同期先を変えたら最初から取り直し、手元の記録は全部送る
      await repo.setMeta(CURSOR_KEY, 0)
      await repo.putLocal(Object.values(get().entries))
      set({ syncConfig: config, syncState: 'idle', syncMessage: null })
      await get().sync()
    },

    async sync() {
      if (!get().syncConfig) return
      if (running) {
        again = true
        return running
      }
      running = (async () => {
        do {
          again = false
          await syncOnce()
        } while (again)
      })()
      try {
        await running
      } finally {
        running = null
      }
    },
  }
})
