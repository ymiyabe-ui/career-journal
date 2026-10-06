import { describe, expect, it } from 'vitest'
import { shiftDate } from './date'
import { computeBadges, earnedIds, nextStreakMilestone } from './badges'
import { runStreak } from './streak'
import { SCHEMA_VERSION, type JournalEntry } from '../types'

const START = '2026-09-01'
/** START から n 日目（0始まり）の日付 */
const day = (n: number) => shiftDate(START, n)
const run = (from: number, count: number) => Array.from({ length: count }, (_, i) => day(from + i))

describe('runStreak', () => {
  it('7日連続でお休み券を1枚もらい、1日休んでも連続がつながる', () => {
    const r = runStreak([...run(0, 7), ...run(8, 1)], day(8)) // 7日書いて1日休み、9日目に記録
    expect(r.current).toBe(8) // 休んだ日は数えない
    expect(r.used).toBe(1)
    expect(r.tickets).toBe(0)
  })

  it('券より多く休むと連続は1から。券はそのまま残る', () => {
    const r = runStreak([...run(0, 7), day(9)], day(9)) // 2日休み、券は1枚
    expect(r.current).toBe(1)
    expect(r.tickets).toBe(1)
    expect(r.used).toBe(0)
  })

  it('券は最大2枚まで', () => {
    const r = runStreak(run(0, 21), day(20)) // 7・14・21日目で3枚もらうが上限2
    expect(r.tickets).toBe(2)
    expect(r.current).toBe(21)
  })

  it('券がないと1日の休みでも連続は切れる', () => {
    const r = runStreak([...run(0, 5), day(6)], day(6))
    expect(r.current).toBe(1)
    expect(r.longest).toBe(5)
  })

  it('いま休み中で券が足りていれば連続は続いていて、残りの券から引いて見せる', () => {
    const dates = run(0, 7) // 7日目の記録（day(6)）で券1枚
    const r = runStreak(dates, day(8)) // 昨日（day(7)）は休み、今日はまだ書いていない
    expect(r.current).toBe(7)
    expect(r.pending).toBe(1)
    expect(r.tickets).toBe(0)
  })

  it('いま休み中で券が足りなければ0', () => {
    expect(runStreak(run(0, 7), day(9)).current).toBe(0) // 2日休み・券1枚
    expect(runStreak(run(0, 3), day(5)).current).toBe(0)
  })

  it('今日未記入でも昨日まで続いていれば切れていない', () => {
    const r = runStreak(run(0, 4), day(4))
    expect(r.current).toBe(4)
    expect(r.pending).toBe(0)
  })

  it('連続N日に初めて届いた日を返す', () => {
    const r = runStreak([...run(0, 3), ...run(10, 4)], day(13))
    expect(r.reached[3]).toBe(day(2))
    expect(r.reached[4]).toBe(day(13)) // 途切れたあとの4日目（初めて届いた日）
  })

  it('記録がなければすべて0', () => {
    expect(runStreak([], day(0))).toMatchObject({ current: 0, longest: 0, tickets: 0 })
  })
})

function entry(date: string): JournalEntry {
  const written = new Date(`${date}T12:00:00+09:00`).toISOString()
  return {
    id: date, date, fields: { wins: 'やったこと' },
    createdAt: written, updatedAt: written, schemaVersion: SCHEMA_VERSION,
  }
}

describe('computeBadges', () => {
  it('連続バッジは届いた日が入り、累計バッジはN件目の日が入る', () => {
    const entries = run(0, 10).map(entry)
    const badges = computeBadges(entries, day(9), 4)
    const byId = Object.fromEntries(badges.map((b) => [b.id, b]))
    expect(byId['streak-3'].earnedOn).toBe(day(2))
    expect(byId['streak-7'].earnedOn).toBe(day(6))
    expect(byId['streak-14'].earnedOn).toBeNull()
    expect(byId['total-10'].earnedOn).toBe(day(9))
    expect(byId['total-30'].earnedOn).toBeNull()
  })

  it('連続が切れても獲得済みのバッジは残る', () => {
    const entries = run(0, 7).map(entry)
    const badges = computeBadges(entries, day(30), 4) // 長く休んで連続は0
    expect(earnedIds(badges).has('streak-7')).toBe(true)
  })

  it('次の連続バッジを返す', () => {
    expect(nextStreakMilestone(0)?.threshold).toBe(3)
    expect(nextStreakMilestone(3)?.threshold).toBe(7)
    expect(nextStreakMilestone(100)).toBeUndefined()
  })
})
