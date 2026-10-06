import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { createMemoryRepository } from '../storage/memory'
import type { EntryRepository } from '../storage/repository'
import { SCHEMA_VERSION, type JournalEntry } from '../types'
import { runSync, SyncError, type Transport } from './sync'

// 本物の GAS の取り込み処理（gas/src/Logic.gs）をサーバー代わりに使う
const require = createRequire(import.meta.url)
const L = require('../../gas/src/Logic.gs') as {
  applySync(
    table: { headers: string[]; rows: string[][] },
    incoming: JournalEntry[],
    since: number,
    now: number,
  ): { table: { headers: string[]; rows: string[][] }; changed: JournalEntry[]; rejected: number }
}

function fakeServer(token = 'secret') {
  let table = { headers: [] as string[], rows: [] as string[][] }
  let clock = 1000
  const transport: Transport = async (_config, body) => {
    if (body.token !== token) return { ok: false, error: 'unauthorized' }
    clock += 1000
    const r = L.applySync(table, body.entries, body.since, clock)
    table = r.table
    return { ok: true, serverTime: clock, entries: r.changed, rejected: r.rejected }
  }
  return { transport, rows: () => table.rows }
}

const config = { url: 'https://example.invalid/exec', token: 'secret' }

function entry(date: string, updatedAt: string, wins: string, extra: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: date,
    date,
    fields: { wins },
    createdAt: updatedAt,
    updatedAt,
    schemaVersion: SCHEMA_VERSION,
    ...extra,
  }
}

const byId = async (repo: EntryRepository) =>
  Object.fromEntries((await repo.list()).map((e) => [e.id, e]))

describe('runSync', () => {
  it('スマホで書いた記録がPCに届き、未送信の印が消える', async () => {
    const server = fakeServer()
    const phone = createMemoryRepository()
    const pc = createMemoryRepository()

    await phone.putLocal([entry('2026-10-05', '2026-10-05T12:00:00.000Z', 'スマホで書いた')])
    expect((await runSync(phone, config, server.transport)).pushed).toBe(1)
    expect(await phone.pendingIds()).toEqual([])

    const r = await runSync(pc, config, server.transport)
    expect(r.applied.map((e) => e.fields.wins)).toEqual(['スマホで書いた'])
    expect((await byId(pc))['2026-10-05'].fields.wins).toBe('スマホで書いた')
  })

  it('両方で同じ日を書いたら、後に書いたほうに揃う', async () => {
    const server = fakeServer()
    const phone = createMemoryRepository()
    const pc = createMemoryRepository()

    await phone.putLocal([entry('2026-10-05', '2026-10-05T12:00:00.000Z', '昼にスマホ')])
    await pc.putLocal([entry('2026-10-05', '2026-10-05T21:00:00.000Z', '夜にPC')])
    await runSync(pc, config, server.transport)
    await runSync(phone, config, server.transport) // スマホの古い版は捨てられ、PCの版を受け取る
    await runSync(pc, config, server.transport)

    expect((await byId(phone))['2026-10-05'].fields.wins).toBe('夜にPC')
    expect((await byId(pc))['2026-10-05'].fields.wins).toBe('夜にPC')
    expect(server.rows()).toHaveLength(1)
  })

  it('削除も相手の端末に伝わる', async () => {
    const server = fakeServer()
    const phone = createMemoryRepository()
    const pc = createMemoryRepository()
    const e = entry('2026-10-04', '2026-10-04T12:00:00.000Z', '消す記録')

    await phone.putLocal([e])
    await runSync(phone, config, server.transport)
    await runSync(pc, config, server.transport)
    await pc.putLocal([{ ...e, deleted: true, updatedAt: '2026-10-05T09:00:00.000Z' }])
    await runSync(pc, config, server.transport)
    await runSync(phone, config, server.transport)

    expect((await byId(phone))['2026-10-04'].deleted).toBe(true)
  })

  it('2回目以降は前回から変わった分だけ受け取る', async () => {
    const server = fakeServer()
    const phone = createMemoryRepository()
    const pc = createMemoryRepository()

    await phone.putLocal([entry('2026-10-01', '2026-10-01T12:00:00.000Z', 'A')])
    await runSync(phone, config, server.transport)
    await runSync(pc, config, server.transport)
    await phone.putLocal([entry('2026-10-02', '2026-10-02T12:00:00.000Z', 'B')])
    await runSync(phone, config, server.transport)

    const r = await runSync(pc, config, server.transport)
    expect(r.applied.map((e) => e.id)).toEqual(['2026-10-02'])
  })

  it('同期中に書き直した記録は手元の版を残し、次回もう一度送る', async () => {
    const server = fakeServer()
    const phone = createMemoryRepository()
    await phone.putLocal([entry('2026-10-05', '2026-10-05T12:00:00.000Z', '最初')])

    const slow: Transport = async (c, body) => {
      // 送信中にユーザーが書き直す
      await phone.putLocal([entry('2026-10-05', '2026-10-05T12:05:00.000Z', '書き直し')])
      return server.transport(c, body)
    }
    await runSync(phone, config, slow)
    expect((await byId(phone))['2026-10-05'].fields.wins).toBe('書き直し')
    expect(await phone.pendingIds()).toEqual(['2026-10-05'])

    await runSync(phone, config, server.transport)
    expect(await phone.pendingIds()).toEqual([])
  })

  it('合言葉が違うときは何も変えずにエラーにする', async () => {
    const server = fakeServer('right')
    const phone = createMemoryRepository()
    await phone.putLocal([entry('2026-10-05', '2026-10-05T12:00:00.000Z', 'A')])

    await expect(runSync(phone, config, server.transport)).rejects.toThrow(SyncError)
    await expect(runSync(phone, config, server.transport)).rejects.toThrow('合言葉が違います')
    expect(await phone.pendingIds()).toEqual(['2026-10-05'])
  })
})
