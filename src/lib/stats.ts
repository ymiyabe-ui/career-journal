import type { JournalEntry, Stats } from '../types'
import { daysBetween, logicalDate } from './date'
import { runStreak } from './streak'

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

/** 連続記録の計算に渡す日付 */
export function streakDates(entries: JournalEntry[], dayStartHour: number): string[] {
  return entries.filter(isFilled).filter((e) => countsForStreak(e, dayStartHour)).map((e) => e.date)
}

/** 集計は保存せず、記録から毎回計算する（過去分の追加・削除でずれないように） */
export function computeStats(entries: JournalEntry[], today: string, dayStartHour: number): Stats {
  const filled = entries.filter(isFilled)
  const streak = runStreak(streakDates(entries, dayStartHour), today)
  const dates = filled.map((e) => e.date).sort()
  const month = today.slice(0, 7)

  return {
    currentStreak: streak.current,
    longestStreak: streak.longest,
    totalEntries: filled.length,
    monthEntries: dates.filter((d) => d.startsWith(month)).length,
    lastEntryDate: dates.at(-1) ?? null,
    todayDone: filled.some((e) => e.date === today),
    restTickets: streak.tickets,
    restPending: streak.pending,
    restUsed: streak.used,
  }
}
