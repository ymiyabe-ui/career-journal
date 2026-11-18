import { endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { MEMO_MARKS } from '../config/memo'
import type { FieldDef, JournalEntry, Memo } from '../types'
import { daysBetween, formatShortJa, formatSlash, shiftDate } from './date'
import { isFilled } from './stats'
import { countWins } from './trends'

export type PeriodId = 'thisMonth' | 'lastMonth' | 'last30' | 'last90' | 'all'

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'thisMonth', label: '今月' },
  { id: 'lastMonth', label: '先月' },
  { id: 'last30', label: '直近30日' },
  { id: 'last90', label: '直近90日' },
  { id: 'all', label: 'すべて' },
]

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** 期間の最初の日と最後の日（どちらも含む）。今月・直近は今日まで */
export function resolvePeriod(
  id: PeriodId,
  today: string,
  earliest?: string,
): { from: string; to: string } {
  const now = parseISO(today)
  switch (id) {
    case 'thisMonth':
      return { from: iso(startOfMonth(now)), to: today }
    case 'lastMonth': {
      const last = subMonths(now, 1)
      return { from: iso(startOfMonth(last)), to: iso(endOfMonth(last)) }
    }
    case 'last30':
      return { from: shiftDate(today, -29), to: today }
    case 'last90':
      return { from: shiftDate(today, -89), to: today }
    case 'all':
      return { from: earliest && earliest < today ? earliest : today, to: today }
  }
}

/**
 * 評価面談や振り返りに貼れる Markdown を作る。
 * 項目（達成・学び・明日のアクション）ごとに、日付順で並べる。
 */
export function buildSummary(
  entries: JournalEntry[],
  fields: FieldDef[],
  range: { from: string; to: string },
  memos: Memo[] = [],
): string {
  const list = entries
    .filter(isFilled)
    .filter((e) => e.date >= range.from && e.date <= range.to)
    .sort((a, b) => a.date.localeCompare(b.date))
  const days = daysBetween(range.from, range.to) + 1

  const lines = [
    `# 成長サマリー（${formatSlash(range.from)}〜${formatSlash(range.to)}）`,
    '',
    `- 記入日数：${list.length}日 / ${days}日`,
    `- 達成の数：${list.reduce((n, e) => n + countWins(e), 0)}件`,
  ]
  const memoLines = buildMemoSection(memos, range)
  if (list.length === 0 && memoLines.length === 0) {
    return [...lines, '', 'この期間の記録はありません。', ''].join('\n')
  }

  for (const field of fields) {
    const rows = list.filter((e) => (e.fields[field.id] ?? '').trim() !== '')
    if (rows.length === 0) continue
    lines.push('', `## ${field.label}`, '')
    for (const e of rows) {
      const text = e.fields[field.id]
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      if (text.length === 1) {
        lines.push(`- ${formatShortJa(e.date)} ${text[0]}`)
      } else {
        lines.push(`- ${formatShortJa(e.date)}`, ...text.map((l) => `  - ${l}`))
      }
    }
  }
  return [...lines, ...memoLines, ''].join('\n')
}

function memoLabel(m: Memo): string {
  if (m.kind === 'life') return '日常'
  const mark = MEMO_MARKS.find((x) => x.id === m.mark)
  return mark ? `仕事・${mark.label}` : '仕事'
}

/** メモを日付ごとにまとめた「## メモ」の節。期間にメモが無ければ空 */
function buildMemoSection(memos: Memo[], range: { from: string; to: string }): string[] {
  const list = memos
    .filter((m) => m.date >= range.from && m.date <= range.to && m.text.trim() !== '')
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  if (list.length === 0) return []
  const out = ['', '## メモ', '']
  let current = ''
  for (const m of list) {
    if (m.date !== current) {
      current = m.date
      out.push(`- ${formatShortJa(m.date)}`)
    }
    const text = m.text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' / ')
    out.push(`  - [${memoLabel(m)}] ${text}`)
  }
  return out
}
