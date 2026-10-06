import { addDays, endOfMonth, format, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns'
import { WINS_FIELD } from '../config/fields'
import type { JournalEntry } from '../types'
import { daysBetween } from './date'
import { isFilled } from './stats'

export type Unit = 'week' | 'month'

export interface Bucket {
  /** 軸に出す短い名前 */
  label: string
  from: string
  /** 今週・今月は今日まで */
  to: string
  days: number
  recorded: number
  /** 0〜1 */
  rate: number
  /** 達成の数（達成欄の1行を1件として数える） */
  wins: number
  /** 今日を含む、まだ終わっていない期間 */
  current: boolean
}

export function countWins(entry: JournalEntry): number {
  return (entry.fields[WINS_FIELD] ?? '').split('\n').filter((l) => l.trim() !== '').length
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** 直近の週（日曜はじまり）または月ごとの、記入率と達成の数 */
export function buckets(
  entries: JournalEntry[],
  today: string,
  unit: Unit,
  count = unit === 'week' ? 8 : 6,
): Bucket[] {
  const filled = entries.filter(isFilled)
  const now = parseISO(today)

  return Array.from({ length: count }, (_, k) => {
    const back = count - 1 - k
    const start = unit === 'week' ? startOfWeek(subWeeks(now, back)) : startOfMonth(subMonths(now, back))
    const fullTo = iso(unit === 'week' ? addDays(start, 6) : endOfMonth(start))
    const from = iso(start)
    const to = fullTo > today ? today : fullTo
    const days = daysBetween(from, to) + 1
    const inRange = filled.filter((e) => e.date >= from && e.date <= to)
    return {
      label: unit === 'week' ? format(start, 'M/d') : format(start, 'M月'),
      from,
      to,
      days,
      recorded: inRange.length,
      rate: inRange.length / days,
      wins: inRange.reduce((sum, e) => sum + countWins(e), 0),
      current: fullTo >= today,
    }
  })
}
