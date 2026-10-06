import Dexie, { type Table } from 'dexie'
import type { JournalEntry } from '../types'
import type { EntryRepository } from './repository'

class JournalDB extends Dexie {
  entries!: Table<JournalEntry, string>
  meta!: Table<{ key: string; value: unknown }, string>
  pending!: Table<{ id: string }, string>

  constructor() {
    super('career-journal')
    this.version(1).stores({ entries: 'id, date, updatedAt' })
    this.version(2).stores({ entries: 'id, date, updatedAt', meta: 'key', pending: 'id' })
  }
}

export function createDexieRepository(): EntryRepository {
  const db = new JournalDB()
  return {
    list: () => db.entries.toArray(),

    putLocal: (entries) =>
      db.transaction('rw', db.entries, db.pending, async () => {
        await db.entries.bulkPut(entries)
        await db.pending.bulkPut(entries.map((e) => ({ id: e.id })))
      }),

    putRemote: (entries) =>
      db.transaction('rw', db.entries, async () => {
        const current = await db.entries.bulkGet(entries.map((e) => e.id))
        const newer = entries.filter((e, i) => !current[i] || current[i].updatedAt < e.updatedAt)
        await db.entries.bulkPut(newer)
        return newer
      }),

    pendingIds: async () => (await db.pending.toArray()).map((p) => p.id),

    clearPending: async (ids) => {
      await db.pending.bulkDelete(ids)
    },

    getMeta: async <T>(key: string) => (await db.meta.get(key))?.value as T | undefined,

    setMeta: async (key, value) => {
      await db.meta.put({ key, value })
    },
  }
}

/** ブラウザに「容量が足りなくなっても消さないで」と申請する。結果は設定画面に出す */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
