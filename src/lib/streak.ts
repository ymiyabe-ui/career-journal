import { REST_TICKET_EVERY, REST_TICKET_MAX } from '../config/milestones'
import { daysBetween } from './date'

export interface StreakResult {
  /** 連続記録の日数（記録した日だけを数える。お休み券で埋めた日は数えない） */
  current: number
  longest: number
  /** 手元に残っているお休み券（いま休み中の分を引いたあと） */
  tickets: number
  /** いま休み中の日数。今日書けばお休み券で埋まる */
  pending: number
  /** これまでに使ったお休み券の枚数 */
  used: number
  /** 連続N日に初めて届いた日（キーはN） */
  reached: Record<number, string>
}

/**
 * 記録した日（連続記録に数えるものだけ）から、連続日数とお休み券を毎回計算する。
 * - 連続N日（REST_TICKET_EVERY の倍数）に届くたびに、お休み券を1枚もらう（上限 REST_TICKET_MAX）
 * - 休んだ日数ぶんの券があれば、次に記録した日に自動で使って連続をつなぐ。足りなければ連続は1から
 */
export function runStreak(dates: string[], today: string): StreakResult {
  const days = [...new Set(dates)].filter((d) => d <= today).sort()
  const reached: Record<number, string> = {}
  let streak = 0
  let longest = 0
  let tickets = 0
  let used = 0
  let prev: string | null = null

  for (const d of days) {
    if (prev === null) {
      streak = 1
    } else {
      const missed = daysBetween(prev, d) - 1
      if (missed === 0) {
        streak++
      } else if (missed <= tickets) {
        tickets -= missed
        used += missed
        streak++
      } else {
        streak = 1
      }
    }
    if (reached[streak] === undefined) reached[streak] = d
    if (streak % REST_TICKET_EVERY === 0) tickets = Math.min(REST_TICKET_MAX, tickets + 1)
    longest = Math.max(longest, streak)
    prev = d
  }

  if (prev === null) return { current: 0, longest: 0, tickets: 0, pending: 0, used: 0, reached }

  // 最後に記録した日と今日のあいだの、すでに過ぎた休み日（今日は数えない）
  const missedNow = Math.max(0, daysBetween(prev, today) - 1)
  if (missedNow === 0) return { current: streak, longest, tickets, pending: 0, used, reached }
  if (missedNow <= tickets) {
    return { current: streak, longest, tickets: tickets - missedNow, pending: missedNow, used, reached }
  }
  return { current: 0, longest, tickets, pending: 0, used, reached }
}
