import { formatShortJa } from '../lib/date'
import type { MemoKind, MemoMark } from '../types'

/** メモの種類。日報にまとめるのは「仕事」だけ */
export const MEMO_KINDS: { id: MemoKind; label: string }[] = [
  { id: 'work', label: '仕事' },
  { id: 'life', label: '日常' },
]

/**
 * 仕事のメモに付ける印。並び順が日報の見出しの順になる。
 * label はメモに付ける短い名前、heading は日報の見出し
 */
export const MEMO_MARKS: { id: MemoMark; label: string; heading: string }[] = [
  { id: 'done', label: '完了', heading: '完了' },
  { id: 'doing', label: '進行中', heading: '進行中' },
  { id: 'todo', label: '宿題', heading: '宿題（次にやること）' },
  { id: 'ask', label: '相談', heading: '相談・確認したいこと' },
]

/** 印のない仕事のメモの見出し */
export const REPORT_OTHER_HEADING = 'その他'

/** 日報の1行目。転職先の形式に合わせてここを変える */
export function reportTitle(date: string): string {
  return `【${formatShortJa(date)}日報】`
}

/** 見出しの前に付ける記号と、1件ごとの行頭の記号 */
export const REPORT_HEADING_PREFIX = '■ '
export const REPORT_BULLET = '・'
