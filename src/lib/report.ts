import {
  MEMO_MARKS,
  REPORT_BULLET,
  REPORT_HEADING_PREFIX,
  REPORT_OTHER_HEADING,
  reportTitle,
} from '../config/memo'
import type { Memo } from '../types'

/** 2行目以降の字下げ。Slack は行頭の全角スペースを消すので半角にする */
const CONTINUATION = '  '

function bulletLines(text: string): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.map((l, i) => (i === 0 ? `${REPORT_BULLET}${l}` : `${CONTINUATION}${l}`))
}

/**
 * その日の仕事のメモを、印ごとの見出しに分けて日報の文章にする。
 * 日常のメモは入れない。0件の見出しは出さない。メモは書いた順に並べる
 */
export function buildDailyReport(memos: Memo[], date: string): string {
  const work = memos
    .filter((m) => m.date === date && m.kind === 'work' && m.text.trim() !== '')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const groups = [
    ...MEMO_MARKS.map((mark) => ({ heading: mark.heading, list: work.filter((m) => m.mark === mark.id) })),
    { heading: REPORT_OTHER_HEADING, list: work.filter((m) => !m.mark) },
  ].filter((g) => g.list.length > 0)

  const lines = [reportTitle(date)]
  for (const g of groups) {
    lines.push('', `${REPORT_HEADING_PREFIX}${g.heading}`)
    for (const m of g.list) lines.push(...bulletLines(m.text))
  }
  return lines.join('\n')
}

/** その日に日報にまとめられるメモがあるか */
export function hasWorkMemos(memos: Memo[], date: string): boolean {
  return memos.some((m) => m.date === date && m.kind === 'work' && m.text.trim() !== '')
}
