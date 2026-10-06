import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, type JournalEntry } from '../types'
import { logicalDate } from './date'
import { pickNewer } from './merge'
import { computeStats, countsForStreak } from './stats'

const H = 4

/** date の記録を、written（ローカル時刻）に書いたものとして作る */
function entry(date: string, written: Date, extra: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: date,
    date,
    fields: { wins: 'やったこと' },
    createdAt: written.toISOString(),
    updatedAt: written.toISOString(),
    schemaVersion: SCHEMA_VERSION,
    ...extra,
  }
}

const at = (d: string, hour = 21) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day, hour)
}

describe('logicalDate', () => {
  it('午前4時より前は前日', () => {
    expect(logicalDate(new Date(2026, 9, 6, 3, 59), H)).toBe('2026-10-05')
    expect(logicalDate(new Date(2026, 9, 6, 4, 0), H)).toBe('2026-10-06')
  })
})

describe('countsForStreak', () => {
  it('当日と翌日に書いた分は数え、2日後は数えない', () => {
    expect(countsForStreak(entry('2026-10-05', at('2026-10-05')), H)).toBe(true)
    expect(countsForStreak(entry('2026-10-05', at('2026-10-06')), H)).toBe(true)
    expect(countsForStreak(entry('2026-10-05', at('2026-10-07')), H)).toBe(false)
  })

  it('翌々日の深夜3時に書いた分は、まだ翌日扱い', () => {
    expect(countsForStreak(entry('2026-10-05', new Date(2026, 9, 7, 3)), H)).toBe(true)
  })
})

describe('computeStats', () => {
  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
  const run = days.map((d) => entry(d, at(d)))

  it('今日未記入でも昨日まで続いていれば連続は切れていない', () => {
    const s = computeStats(run, '2026-10-05', H)
    expect(s.currentStreak).toBe(4)
    expect(s.todayDone).toBe(false)
  })

  it('一昨日で止まっていれば0', () => {
    expect(computeStats(run, '2026-10-06', H).currentStreak).toBe(0)
  })

  it('後から書き足した分は累計にだけ入る', () => {
    const gap = [
      entry('2026-10-01', at('2026-10-01')),
      entry('2026-10-02', at('2026-10-05')), // 3日後に書き足し
      entry('2026-10-03', at('2026-10-03')),
    ]
    const s = computeStats(gap, '2026-10-03', H)
    expect(s.currentStreak).toBe(1)
    expect(s.longestStreak).toBe(1)
    expect(s.totalEntries).toBe(3)
  })

  it('削除済み・空の記録は数えない', () => {
    const list = [
      ...run,
      entry('2026-10-05', at('2026-10-05'), { deleted: true }),
      entry('2026-09-30', at('2026-09-30'), { fields: { wins: '  ' } }),
    ]
    const s = computeStats(list, '2026-10-05', H)
    expect(s.totalEntries).toBe(4)
    expect(s.longestStreak).toBe(4)
    expect(s.monthEntries).toBe(4)
  })

  it('最長は途切れた過去の連続も見る', () => {
    const list = [
      ...['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'].map((d) =>
        entry(d, at(d)),
      ),
      ...run,
    ]
    const s = computeStats(list, '2026-10-04', H)
    expect(s.longestStreak).toBe(5)
    expect(s.currentStreak).toBe(4)
  })
})

describe('pickNewer', () => {
  it('更新日時が新しいものだけ上書き対象にする', () => {
    const old = entry('2026-10-01', at('2026-10-01', 10))
    const newer = entry('2026-10-01', at('2026-10-01', 22))
    const fresh = entry('2026-10-02', at('2026-10-02'))
    expect(pickNewer({ [old.id]: old }, [newer, fresh])).toEqual([newer, fresh])
    expect(pickNewer({ [newer.id]: newer }, [old])).toEqual([])
  })
})
