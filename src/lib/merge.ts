import type { JournalEntry } from '../types'

/**
 * 同じ id の記録は updatedAt が新しいほうを残す。
 * JSONの読み込みと、Step2 のスプレッドシート同期で共通に使う。
 * 戻り値は incoming のうち local を上書きすべきものだけ。
 */
export function pickNewer(
  local: Record<string, JournalEntry>,
  incoming: JournalEntry[],
): JournalEntry[] {
  return incoming.filter((e) => {
    const current = local[e.id]
    return !current || current.updatedAt < e.updatedAt
  })
}
