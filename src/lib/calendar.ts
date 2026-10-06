import { addMonths, format, getDay, getDaysInMonth, parseISO } from 'date-fns'

/** 月（yyyy-MM）を、日曜はじまりの週ごとの表にする。月の外の欄は null */
export function monthMatrix(month: string): (string | null)[][] {
  const first = parseISO(`${month}-01`)
  const days = Array.from(
    { length: getDaysInMonth(first) },
    (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
  )
  const cells: (string | null)[] = [...Array<null>(getDay(first)).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function shiftMonth(month: string, delta: number): string {
  return format(addMonths(parseISO(`${month}-01`), delta), 'yyyy-MM')
}

/** 例：2026年10月 */
export function formatMonthJa(month: string): string {
  return format(parseISO(`${month}-01`), 'yyyy年M月')
}
