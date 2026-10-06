import {
  DEFAULT_THRESHOLDS,
  streakLabel,
  totalLabel,
  type MilestoneDef,
  type Thresholds,
} from '../config/milestones'
import type { Badge, JournalEntry } from '../types'
import { isFilled, streakDates } from './stats'
import { runStreak } from './streak'

/**
 * バッジは保存せず、記録から毎回計算する。記録が同期されれば、どの端末でも同じバッジになる。
 * earnedOn が null のものは未獲得。
 */
export function computeBadges(
  entries: JournalEntry[],
  today: string,
  dayStartHour: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Badge[] {
  const reached = runStreak(streakDates(entries, dayStartHour), today).reached
  const filledDates = entries
    .filter(isFilled)
    .map((e) => e.date)
    .sort()

  const streak: Badge[] = thresholds.streak.map((n) => ({
    id: `streak-${n}`,
    kind: 'streak',
    threshold: n,
    label: streakLabel(n),
    earnedOn: reached[n] ?? null,
  }))
  const total: Badge[] = thresholds.total.map((n) => ({
    id: `total-${n}`,
    kind: 'total',
    threshold: n,
    label: totalLabel(n),
    earnedOn: filledDates[n - 1] ?? null,
  }))
  return [...streak, ...total]
}

export function earnedIds(badges: Badge[]): Set<string> {
  return new Set(badges.filter((b) => b.earnedOn).map((b) => b.id))
}

/** いまの連続日数より先にある、いちばん近い連続のバッジ */
export function nextStreakMilestone(
  current: number,
  streak: number[] = DEFAULT_THRESHOLDS.streak,
): MilestoneDef | undefined {
  const next = [...streak].sort((a, b) => a - b).find((n) => n > current)
  return next === undefined ? undefined : { threshold: next, label: streakLabel(next) }
}
