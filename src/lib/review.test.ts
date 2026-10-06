import { describe, expect, it } from 'vitest'
import { DEFAULT_FIELDS } from '../config/fields'
import { SCHEMA_VERSION, type JournalEntry } from '../types'
import { formatMonthJa, monthMatrix, shiftMonth } from './calendar'
import { buildSummary, resolvePeriod } from './summary'
import { buckets, countWins } from './trends'

function entry(date: string, fields: Record<string, string>): JournalEntry {
  const at = `${date}T03:00:00.000Z`
  return { id: date, date, fields, createdAt: at, updatedAt: at, schemaVersion: SCHEMA_VERSION }
}

describe('monthMatrix', () => {
  it('2026年10月は木曜はじまり・31日・5週', () => {
    const weeks = monthMatrix('2026-10')
    expect(weeks).toHaveLength(5)
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03'])
    expect(weeks[4].at(-1)).toBe('2026-10-31')
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('日曜はじまりの月は先頭に空きがない（2026年2月）', () => {
    const weeks = monthMatrix('2026-02')
    expect(weeks[0][0]).toBe('2026-02-01')
    expect(weeks).toHaveLength(4)
  })

  it('月の移動と表示', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(formatMonthJa('2026-10')).toBe('2026年10月')
  })
})

describe('buckets', () => {
  const entries = [
    entry('2026-09-27', { wins: 'A\nB' }), // 日
    entry('2026-09-30', { wins: 'C' }),
    entry('2026-10-04', { wins: 'D' }), // 今週（日曜）
    entry('2026-10-06', { wins: 'E\n\nF\nG' }), // 今日（火）
    entry('2026-10-05', { wins: '  ' }), // 空は数えない
  ]

  it('週：日曜はじまり。今週は今日までの日数で割る', () => {
    const b = buckets(entries, '2026-10-06', 'week', 2)
    expect(b.map((x) => x.label)).toEqual(['9/27', '10/4'])
    expect(b[0]).toMatchObject({ from: '2026-09-27', to: '2026-10-03', days: 7, recorded: 2, wins: 3, current: false })
    expect(b[1]).toMatchObject({ from: '2026-10-04', to: '2026-10-06', days: 3, recorded: 2, wins: 4, current: true })
    expect(b[1].rate).toBeCloseTo(2 / 3)
  })

  it('月：今月は今日までの日数で割る', () => {
    const b = buckets(entries, '2026-10-06', 'month', 2)
    expect(b.map((x) => x.label)).toEqual(['9月', '10月'])
    expect(b[0]).toMatchObject({ days: 30, recorded: 2 })
    expect(b[1]).toMatchObject({ days: 6, recorded: 2, current: true })
  })

  it('達成の数は空行を除いた行数', () => {
    expect(countWins(entry('2026-10-06', { wins: 'E\n\nF\nG' }))).toBe(3)
    expect(countWins(entry('2026-10-06', { learning: 'x' }))).toBe(0)
  })
})

describe('resolvePeriod', () => {
  it('期間の範囲', () => {
    expect(resolvePeriod('thisMonth', '2026-10-06')).toEqual({ from: '2026-10-01', to: '2026-10-06' })
    expect(resolvePeriod('lastMonth', '2026-10-06')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(resolvePeriod('last30', '2026-10-06')).toEqual({ from: '2026-09-07', to: '2026-10-06' })
    expect(resolvePeriod('last90', '2026-10-06')).toEqual({ from: '2026-07-09', to: '2026-10-06' })
    expect(resolvePeriod('all', '2026-10-06', '2026-08-15')).toEqual({ from: '2026-08-15', to: '2026-10-06' })
    expect(resolvePeriod('all', '2026-10-06')).toEqual({ from: '2026-10-06', to: '2026-10-06' })
  })

  it('年をまたぐ先月（1月 → 前年12月）', () => {
    expect(resolvePeriod('lastMonth', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })
})

describe('buildSummary', () => {
  const entries = [
    entry('2026-10-05', { wins: '見積もりを出した', learning: '前提を先に書くと質問が減る' }),
    entry('2026-10-03', { wins: '提案書を直した\nA社に連絡した', nextAction: 'B社に日程を送る' }),
    entry('2026-09-01', { wins: '期間の外' }),
    { ...entry('2026-10-04', { wins: '削除済み' }), deleted: true },
  ]

  it('項目ごとに日付順で並べ、複数行は入れ子の箇条書きにする', () => {
    const md = buildSummary(entries, DEFAULT_FIELDS, { from: '2026-10-01', to: '2026-10-06' })
    expect(md).toBe(
      [
        '# 成長サマリー（2026/10/01〜2026/10/06）',
        '',
        '- 記入日数：2日 / 6日',
        '- 達成の数：3件',
        '',
        '## 今日の達成',
        '',
        '- 10/3（土）',
        '  - 提案書を直した',
        '  - A社に連絡した',
        '- 10/5（月） 見積もりを出した',
        '',
        '## 学び・気づき',
        '',
        '- 10/5（月） 前提を先に書くと質問が減る',
        '',
        '## 明日やる1アクション',
        '',
        '- 10/3（土） B社に日程を送る',
        '',
      ].join('\n'),
    )
  })

  it('記録がない期間はその旨を書く', () => {
    const md = buildSummary(entries, DEFAULT_FIELDS, { from: '2026-08-01', to: '2026-08-31' })
    expect(md).toContain('記入日数：0日 / 31日')
    expect(md).toContain('この期間の記録はありません。')
    expect(md).not.toContain('## ')
  })
})
