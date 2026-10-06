import type { JournalEntry, Stats } from '../types'
import { daysBetween, logicalDate, shiftDate } from './date'

export function isFilled(entry: JournalEntry | undefined): entry is JournalEntry {
  return !!entry && !entry.deleted && Object.values(entry.fields).some((v) => v.trim() !== '')
}

/**
 * 連続記録に数えるか。対象日の当日か翌日に書いたものだけを数える。
 * 2日以上後から書き足した分は累計にだけ入る。
 */
export function countsForStreak(entry: JournalEntry, dayStartHour: number): boolean {
  const writtenOn = logicalDate(new Date(entry.createdAt), dayStartHour)
  return daysBetween(entry.date, writtenOn) <= 1
}

/** 集計は保存せず、記録から毎回計算する（過去分の追加・削除でずれないように） */
export function computeStats(entries: JournalEntry[], today: string, dayStartHour: number): Stats {
  const filled = entries.filter(isFilled)
  const streakDates = new Set(
    filled.filter((e) => countsForStreak(e, dayStartHour)).map((e) => e.date),
  )

  // 今日まだ書いていなくても、昨日まで続いていれば連続は切れていない
  let cursor = streakDates.has(today) ? today : shiftDate(today, -1)
  let currentStreak = 0
  while (streakDates.has(cursor)) {
    currentStreak++
    cursor = shiftDate(cursor, -1)
  }

  let longestStreak = 0
  let run = 0
  let prev: string | null = null
  for (const date of [...streakDates].sort()) {
    run = prev !== null && daysBetween(prev, date) === 1 ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    prev = date
  }

  const dates = filled.map((e) => e.date).sort()
  const month = today.slice(0, 7)

  return {
    currentStreak,
    longestStreak,
    totalEntries: filled.length,
    monthEntries: dates.filter((d) => d.startsWith(month)).length,
    lastEntryDate: dates.at(-1) ?? null,
    todayDone: filled.some((e) => e.date === today),
  }
}
