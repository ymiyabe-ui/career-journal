import {
  STREAK_MILESTONES,
  TOTAL_MILESTONES,
  type MilestoneDef,
} from '../config/milestones'
import type { Badge, JournalEntry } from '../types'
import { isFilled, streakDates } from './stats'
import { runStreak } from './streak'

/**
 * バッジは保存せず、記録から毎回計算する。記録が同期されれば、どの端末でも同じバッジになる。
 * earnedOn が null のものは未獲得。
 */
export function computeBadges(entries: JournalEntry[], today: string, dayStartHour: number): Badge[] {
  const reached = runStreak(streakDates(entries, dayStartHour), today).reached
  const filledDates = entries
    .filter(isFilled)
    .map((e) => e.date)
    .sort()

  const streak: Badge[] = STREAK_MILESTONES.map((m) => ({
    id: `streak-${m.threshold}`,
    kind: 'streak',
    threshold: m.threshold,
    label: m.label,
    earnedOn: reached[m.threshold] ?? null,
  }))
  const total: Badge[] = TOTAL_MILESTONES.map((m) => ({
    id: `total-${m.threshold}`,
    kind: 'total',
    threshold: m.threshold,
    label: m.label,
    earnedOn: filledDates[m.threshold - 1] ?? null,
  }))
  return [...streak, ...total]
}

export function earnedIds(badges: Badge[]): Set<string> {
  return new Set(badges.filter((b) => b.earnedOn).map((b) => b.id))
}

/** いまの連続日数より先にある、いちばん近い連続のバッジ */
export function nextStreakMilestone(current: number): MilestoneDef | undefined {
  return STREAK_MILESTONES.find((m) => m.threshold > current)
}
