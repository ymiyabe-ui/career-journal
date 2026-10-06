// npm run test:gas
// 同期の取り込み規則（新しいほうを残す・差分の返し方・列の追加）とリマインドの判定を確かめる
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const L = require('../src/Logic.gs')

const entry = (date, updatedAt, fields = { wins: 'やったこと' }, extra = {}) => ({
  id: date,
  date,
  fields,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt,
  schemaVersion: 1,
  ...extra,
})

const empty = { headers: [], rows: [] }

test('空の表に取り込むと固定列＋項目列ができ、取り込んだ分が差分として返る', () => {
  const r = L.applySync(empty, [entry('2026-10-01', '2026-10-01T12:00:00.000Z', { wins: 'A', learning: 'B' })], 0, 1000)
  assert.deepEqual(r.table.headers, [...L.FIXED_HEADERS, 'wins', 'learning'])
  assert.equal(r.accepted, 1)
  assert.equal(r.changed.length, 1)
  assert.deepEqual(r.changed[0].fields, { wins: 'A', learning: 'B' })
  assert.equal(r.table.rows[0][L.FIXED_HEADERS.indexOf('syncedAt')], '1000')
})

test('同じ日の記録は updatedAt が新しいほうだけ上書きする', () => {
  const first = L.applySync(empty, [entry('2026-10-01', '2026-10-01T12:00:00.000Z', { wins: '新' })], 0, 1000).table
  const older = L.applySync(first, [entry('2026-10-01', '2026-10-01T11:00:00.000Z', { wins: '古' })], 1000, 2000)
  assert.equal(older.accepted, 0)
  assert.equal(older.changed.length, 0)
  const newer = L.applySync(first, [entry('2026-10-01', '2026-10-01T13:00:00.000Z', { wins: '更新' })], 1000, 2000)
  assert.equal(newer.accepted, 1)
  assert.equal(newer.changed[0].fields.wins, '更新')
})

test('since より後にサーバーで書いた分だけ返す（端末の時計ではなくサーバー時刻で見る）', () => {
  let t = L.applySync(empty, [entry('2026-10-01', '2026-10-01T12:00:00.000Z')], 0, 1000).table
  // 時計が遅れている端末が、後から古い updatedAt の別の日を送ってくる
  t = L.applySync(t, [entry('2026-09-30', '2026-09-30T08:00:00.000Z')], 1000, 2000).table
  const pull = L.applySync(t, [], 1000, 3000)
  assert.deepEqual(pull.changed.map((e) => e.id), ['2026-09-30'])
})

test('削除の印も同期される', () => {
  const t = L.applySync(empty, [entry('2026-10-01', '2026-10-01T12:00:00.000Z')], 0, 1000).table
  const r = L.applySync(t, [entry('2026-10-01', '2026-10-02T00:00:00.000Z', { wins: 'やったこと' }, { deleted: true })], 1000, 2000)
  assert.equal(r.changed[0].deleted, true)
})

test('後から増えた入力項目は列を右に足し、既存の行は空欄で埋める', () => {
  const t = L.applySync(empty, [entry('2026-10-01', '2026-10-01T12:00:00.000Z')], 0, 1000).table
  const r = L.applySync(t, [entry('2026-10-02', '2026-10-02T12:00:00.000Z', { wins: 'A', mood: '良い' })], 1000, 2000)
  assert.equal(r.table.headers.at(-1), 'mood')
  assert.equal(r.table.rows[0].length, r.table.headers.length)
  const all = L.applySync(r.table, [], 0, 3000).changed
  assert.deepEqual(all[0].fields, { wins: 'やったこと', mood: '' })
})

test('列の並びを手で入れ替えても id で行を探せる', () => {
  const t = L.applySync(empty, [entry('2026-10-01', '2026-10-01T12:00:00.000Z', { wins: '元' })], 0, 1000).table
  const order = [...t.headers].reverse()
  const swapped = { headers: order, rows: t.rows.map((r) => order.map((h) => r[t.headers.indexOf(h)])) }
  const r = L.applySync(swapped, [entry('2026-10-01', '2026-10-01T13:00:00.000Z', { wins: '新' })], 1000, 2000)
  assert.equal(r.table.rows.length, 1)
  assert.equal(r.changed[0].fields.wins, '新')
})

test('形のおかしい記録は取り込まない', () => {
  const bad = [
    entry('2026/10/01', '2026-10-01T12:00:00.000Z'),
    { ...entry('2026-10-01', '2026-10-01T12:00:00.000Z'), id: 'x' },
    entry('2026-10-01', 'きのう'),
    entry('2026-10-01', '2026-10-01T12:00:00.000Z', { '=IMPORTXML': 'a' }),
    entry('2026-10-01', '2026-10-01T12:00:00.000Z', { wins: 1 }),
  ]
  const r = L.applySync(empty, bad, 0, 1000)
  assert.equal(r.accepted, 0)
  assert.equal(r.rejected, bad.length)
})

test('日本時間・午前4時区切りの今日', () => {
  assert.equal(L.logicalTodayJst(new Date('2026-10-05T12:00:00Z'), 4), '2026-10-05') // 21:00 JST
  assert.equal(L.logicalTodayJst(new Date('2026-10-05T18:30:00Z'), 4), '2026-10-05') // 翌3:30 JST
  assert.equal(L.logicalTodayJst(new Date('2026-10-05T19:00:00Z'), 4), '2026-10-06') // 翌4:00 JST
})

test('リマインド判定：削除済み・空の記録は書いたことにしない', () => {
  const t = L.applySync(empty, [
    entry('2026-10-04', '2026-10-04T12:00:00.000Z'),
    entry('2026-10-05', '2026-10-05T12:00:00.000Z', { wins: ' ' }),
  ], 0, 1000).table
  assert.equal(L.hasEntryOn(t, '2026-10-04'), true)
  assert.equal(L.hasEntryOn(t, '2026-10-05'), false)
})
