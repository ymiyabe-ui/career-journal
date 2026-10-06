import type { JournalEntry } from '../types'
import type { EntryRepository } from './repository'

/** テスト用。dexie.ts と同じ約束で動く */
export function createMemoryRepository(): EntryRepository {
  const entries = new Map<string, JournalEntry>()
  const pending = new Set<string>()
  const meta = new Map<string, unknown>()

  return {
    list: async () => [...entries.values()],
    putLocal: async (list) => {
      for (const e of list) {
        entries.set(e.id, e)
        pending.add(e.id)
      }
    },
    putRemote: async (list) => {
      const newer = list.filter((e) => {
        const current = entries.get(e.id)
        return !current || current.updatedAt < e.updatedAt
      })
      for (const e of newer) entries.set(e.id, e)
      return newer
    },
    pendingIds: async () => [...pending],
    clearPending: async (ids) => ids.forEach((id) => pending.delete(id)),
    getMeta: async <T>(key: string) => meta.get(key) as T | undefined,
    setMeta: async (key, value) => {
      meta.set(key, value)
    },
  }
}
