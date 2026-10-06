import { addDays, differenceInCalendarDays, format, parseISO, subHours } from 'date-fns'
import { ja } from 'date-fns/locale'

/** 時刻を「記録の対象日」に変える。dayStartHour 時より前は前日扱い */
export function logicalDate(at: Date, dayStartHour: number): string {
  return format(subHours(at, dayStartHour), 'yyyy-MM-dd')
}

export function shiftDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd')
}

/** from から to まで何日あるか（to が後なら正） */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from))
}

/** 例：10月5日（日） */
export function formatDateJa(date: string): string {
  return format(parseISO(date), 'M月d日（E）', { locale: ja })
}

/** 例：10/5（日） */
export function formatShortJa(date: string): string {
  return format(parseISO(date), 'M/d（E）', { locale: ja })
}

/** 例：2026/10/05 */
export function formatSlash(date: string): string {
  return format(parseISO(date), 'yyyy/MM/dd')
}
