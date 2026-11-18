import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { createKeyInfo, openMemo, sealDeleted, sealMemo, unlockKey } from '../lib/crypto'
import { createMemoryRepository } from '../storage/memory'
import type { EntryRepository } from '../storage/repository'
import type { JournalEntry, Memo, MemoKeyInfo, SealedMemo } from '../types'
import { MEMO_KEY_INFO_KEY, MEMO_SERVER_KEY, runSync, type Transport } from './sync'

// 本物の GAS の取り込み処理（gas/src/Logic.gs）をサーバー代わりに使う
const require = createRequire(import.meta.url)
type Table = { headers: string[]; rows: string[][] }
const L = require('../../gas/src/Logic.gs') as {
  applySync(table: Table, incoming: JournalEntry[], since: number, now: number): { table: Table; changed: JournalEntry[]; rejected: number }
  applyMemoSync(table: Table, incoming: SealedMemo[], since: number, now: number): { table: Table; changed: SealedMemo[]; rejected: number }
  chooseMemoKey(stored: unknown, incoming: unknown): { key: MemoKeyInfo | null; changed: boolean }
}

const ITER = 1000

function fakeServer({ memoSupport = true } = {}) {
  let table: Table = { headers: [], rows: [] }
  let memoTable: Table = { headers: [], rows: [] }
  let memoKey: MemoKeyInfo | null = null
  let clock = 1000
  const transport: Transport = async (_config, body) => {
    clock += 1000
    const r = L.applySync(table, body.entries, body.since, clock)
    table = r.table
    if (!memoSupport) return { ok: true, serverTime: clock, entries: r.changed, rejected: r.rejected, settings: null }
    const k = L.chooseMemoKey(memoKey, body.memoKey)
    memoKey = k.key
    const m = L.applyMemoSync(memoTable, body.memos, body.since, clock)
    memoTable = m.table
    return {
      ok: true,
      serverTime: clock,
      entries: r.changed,
      rejected: r.rejected,
      settings: null,
      memos: m.changed,
      memoKey,
      memoRejected: m.rejected,
    }
  }
  return { transport, memoRows: () => memoTable.rows, memoKey: () => memoKey }
}

const config = { url: 'https://example.invalid/exec', token: 'secret' }

const memo = (id: string, text: string, updatedAt = '2026-11-18T01:00:00.000Z'): Memo => ({
  id,
  date: '2026-11-18',
  createdAt: '2026-11-18T01:00:00.000Z',
  updatedAt,
  text,
  kind: 'work',
  mark: 'done',
})

/** 端末で合言葉を決める（memoStore の create と同じ保存のしかた） */
async function setupKey(repo: EntryRepository, pass: string) {
  const { info, key } = await createKeyInfo(pass, ITER)
  await repo.setMeta(MEMO_KEY_INFO_KEY, info)
  return key
}

/** resend が立っていればもう一度同期する（store の sync と同じ動き） */
async function syncUntilDone(repo: EntryRepository, transport: Transport) {
  let r = await runSync(repo, config, transport)
  for (let i = 0; r.memos.resend && i < 3; i++) r = await runSync(repo, config, transport)
  return r
}

describe('メモの同期', () => {
  it('スマホで書いたメモが暗号化したままPCに届き、同じ合言葉で読める', async () => {
    const server = fakeServer()
    const phone = createMemoryRepository()
    const pc = createMemoryRepository()

    const key = await setupKey(phone, 'いつもの合言葉です')
    await phone.putLocalMemos([await sealMemo(key, memo('memo-0001-aaaa', 'A社 初回面談'))])

    // 1回目で鍵を登録し、同期先と同じ鍵と分かってからメモを送る
    const first = await runSync(phone, config, server.transport)
    expect(first.memos.status).toBe('ok')
    expect(first.memos.resend).toBe(true)
    expect(server.memoRows()).toHaveLength(0)
    const second = await runSync(phone, config, server.transport)
    expect(second.memos.resend).toBe(false)
    expect(server.memoRows()).toHaveLength(1)
    expect(await phone.pendingMemoIds()).toEqual([])

    // 同期先には読めない文字列だけ
    expect(JSON.stringify(server.memoRows())).not.toContain('A社')

    // PC は合言葉を入れる前でも暗号化したまま受け取る
    const atPc = await runSync(pc, config, server.transport)
    expect(atPc.memos.status).toBe('nokey')
    expect(await pc.getMeta(MEMO_SERVER_KEY)).toEqual(server.memoKey())
    const [sealed] = await pc.listMemos()
    const pcKey = await unlockKey('いつもの合言葉です', (await pc.getMeta<MemoKeyInfo>(MEMO_SERVER_KEY))!)
    expect((await openMemo(pcKey!, sealed))?.text).toBe('A社 初回面談')
  })

  it('別の端末で先に決めた合言葉と違えば、メモを送らずに手元に残す', async () => {
    const server = fakeServer()
    const phone = createMemoryRepository()
    const pc = createMemoryRepository()

    await setupKey(phone, '先に決めた合言葉')
    await syncUntilDone(phone, server.transport)

    const pcKey = await setupKey(pc, 'あとで決めた合言葉')
    await pc.putLocalMemos([await sealMemo(pcKey, memo('memo-0002-bbbb', 'PCで書いた'))])
    const r = await syncUntilDone(pc, server.transport)
    expect(r.memos.status).toBe('conflict')
    expect(server.memoRows()).toHaveLength(0)
    expect(await pc.pendingMemoIds()).toEqual(['memo-0002-bbbb'])
    // 同期先の鍵は先に決めたほうのまま
    expect(server.memoKey()).toEqual(await phone.getMeta(MEMO_KEY_INFO_KEY))
  })

  it('同期先が古い版なら unsupported で、メモは未送信のまま残る', async () => {
    const server = fakeServer({ memoSupport: false })
    const phone = createMemoryRepository()
    const key = await setupKey(phone, 'いつもの合言葉です')
    await phone.putLocalMemos([await sealMemo(key, memo('memo-0003-cccc', '古い同期先'))])

    const r = await syncUntilDone(phone, server.transport)
    expect(r.memos.status).toBe('unsupported')
    expect(await phone.pendingMemoIds()).toEqual(['memo-0003-cccc'])
    expect(await phone.getMeta(MEMO_SERVER_KEY)).toBeUndefined()
  })

  it('消したメモは中身なしでほかの端末に伝わり、直したメモは新しいほうが残る', async () => {
    const server = fakeServer()
    const phone = createMemoryRepository()
    const pc = createMemoryRepository()
    const key = await setupKey(phone, 'いつもの合言葉です')

    const a = memo('memo-0004-dddd', '消すメモ')
    const b = memo('memo-0005-eeee', '直す前')
    await phone.putLocalMemos([await sealMemo(key, a), await sealMemo(key, b)])
    await syncUntilDone(phone, server.transport)
    await syncUntilDone(pc, server.transport)

    await phone.putLocalMemos([
      sealDeleted(a, '2026-11-18T03:00:00.000Z'),
      await sealMemo(key, { ...b, text: '直したあと', updatedAt: '2026-11-18T03:00:00.000Z' }),
    ])
    await syncUntilDone(phone, server.transport)
    await syncUntilDone(pc, server.transport)

    const atPc = Object.fromEntries((await pc.listMemos()).map((m) => [m.id, m]))
    expect(atPc['memo-0004-dddd']).toMatchObject({ deleted: true, iv: '', ct: '' })
    expect((await openMemo(key, atPc['memo-0005-eeee']))?.text).toBe('直したあと')
  })
})
