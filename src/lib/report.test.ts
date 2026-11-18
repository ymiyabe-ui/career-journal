import { describe, expect, it } from 'vitest'
import type { Memo } from '../types'
import { buildDailyReport, hasWorkMemos } from './report'
import { buildSummary } from './summary'

let n = 0
const memo = (text: string, extra: Partial<Memo> = {}): Memo => {
  n++
  const at = `2026-11-18T0${n % 10}:00:00.000Z`
  return { id: `memo-${n}-xxxx`, date: '2026-11-18', createdAt: at, updatedAt: at, text, kind: 'work', ...extra }
}

describe('日報にまとめる', () => {
  it('印ごとの見出しに、書いた順で並べる。日常のメモと0件の見出しは出さない', () => {
    const memos = [
      memo('B社 提案書を送った', { mark: 'done', createdAt: '2026-11-18T05:00:00.000Z' }),
      memo('A社 初回面談', { mark: 'done', createdAt: '2026-11-18T01:00:00.000Z' }),
      memo('朝の散歩', { kind: 'life' }),
      memo('C社 資料2点を作る', { mark: 'todo' }),
      memo('移動中に思いついた案'),
    ]
    expect(buildDailyReport(memos, '2026-11-18')).toBe(
      [
        '【11/18（水）日報】',
        '',
        '■ 完了',
        '・A社 初回面談',
        '・B社 提案書を送った',
        '',
        '■ 宿題（次にやること）',
        '・C社 資料2点を作る',
        '',
        '■ その他',
        '・移動中に思いついた案',
      ].join('\n'),
    )
  })

  it('2行以上のメモは2行目から半角スペースで字下げする', () => {
    const text = buildDailyReport([memo('D社 定例\n次回は12/2\n', { mark: 'doing' })], '2026-11-18')
    expect(text.split('\n').slice(2)).toEqual(['■ 進行中', '・D社 定例', '  次回は12/2'])
  })

  it('ほかの日のメモは入れない', () => {
    const text = buildDailyReport([memo('前の日', { date: '2026-11-17' }), memo('今日')], '2026-11-18')
    expect(text).not.toContain('前の日')
    expect(text).toContain('・今日')
  })

  it('hasWorkMemos：仕事のメモがあるときだけ true', () => {
    expect(hasWorkMemos([memo('散歩', { kind: 'life' })], '2026-11-18')).toBe(false)
    expect(hasWorkMemos([memo('面談')], '2026-11-18')).toBe(true)
    expect(hasWorkMemos([memo('面談')], '2026-11-19')).toBe(false)
  })
})

describe('サマリーにメモを入れる', () => {
  const range = { from: '2026-11-17', to: '2026-11-18' }

  it('日付ごとに、種類と印を付けて並べる', () => {
    const md = buildSummary(
      [],
      [],
      range,
      [
        memo('A社 初回面談', { mark: 'done' }),
        memo('朝の散歩', { kind: 'life' }),
        memo('前の日のメモ\n2行目', { date: '2026-11-17' }),
        memo('期間の外', { date: '2026-11-10' }),
      ],
    )
    expect(md).toContain(
      ['## メモ', '', '- 11/17（火）', '  - [仕事] 前の日のメモ / 2行目', '- 11/18（水）'].join('\n'),
    )
    expect(md).toContain('  - [仕事・完了] A社 初回面談')
    expect(md).toContain('  - [日常] 朝の散歩')
    expect(md).not.toContain('期間の外')
    expect(md).not.toContain('この期間の記録はありません')
  })

  it('メモを渡さなければ今までどおり', () => {
    expect(buildSummary([], [], range)).toContain('この期間の記録はありません。')
  })
})
