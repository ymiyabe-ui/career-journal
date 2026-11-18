import { useMemo } from 'react'
import { create } from 'zustand'
import { createKeyInfo, openMemo, sameKeyInfo, sealDeleted, sealMemo, unlockKey } from './lib/crypto'
import { repo, useJournal } from './store'
import { MEMO_KEY_INFO_KEY, MEMO_SERVER_KEY, type MemoSyncResult } from './sync/sync'
import type { Memo, MemoBody, MemoKeyInfo, SealedMemo } from './types'

/** 端末に置く鍵（取り出せない形の CryptoKey）。合言葉そのものは保存しない */
const CRYPTO_KEY = 'memoCryptoKey'

/** メモの本文の上限（文字数） */
export const MEMO_MAX_LENGTH = 2000

/**
 * - loading：読み込み中
 * - setup：まだどの端末でも合言葉を決めていない
 * - unlock：合言葉は決まっているが、この端末ではまだ入れていない（またはロックした）
 * - ready：書ける・読める
 */
export type MemoKeyState = 'loading' | 'setup' | 'unlock' | 'ready'

interface MemoState {
  /** 復号したメモ（削除済みは入れない） */
  memos: Record<string, Memo>
  /** 読めなかったメモの数（ほかの合言葉で書かれたもの） */
  unreadable: number
  keyState: MemoKeyState
  /** この端末の合言葉が、同期先にある合言葉（別の端末で先に決めたもの）と違う */
  conflict: boolean
  /** 同期先に合言葉があるかを確かめ済みか。まだなら、新しく決める前に注意を出す */
  serverChecked: boolean
  load(): Promise<void>
  /** 新しい合言葉を決める */
  create(passphrase: string): Promise<void>
  /** 決めてある合言葉を入れる。違えば false */
  unlock(passphrase: string): Promise<boolean>
  /** この端末から鍵を消す。メモは暗号化したまま残り、合言葉を入れれば読める */
  lock(): Promise<void>
  /** 合言葉を忘れたとき：この端末のメモと鍵を全部消す（同期先は gas/README.md の手順で先に消す） */
  forget(): Promise<void>
  add(date: string, body: MemoBody): Promise<void>
  update(id: string, body: MemoBody): Promise<void>
  remove(id: string): Promise<void>
  /** JSONの控えから読み込む。読み込んだ件数を返す */
  importSealed(memos: SealedMemo[], info: MemoKeyInfo | null): Promise<number>
}

// 鍵は状態に入れず、このファイルの中だけで持つ
let key: CryptoKey | null = null
const unreadableIds = new Set<string>()

async function readKeyInfo() {
  const [local, server] = await Promise.all([
    repo.getMeta<MemoKeyInfo>(MEMO_KEY_INFO_KEY),
    repo.getMeta<MemoKeyInfo | null>(MEMO_SERVER_KEY),
  ])
  return { local: local ?? null, server }
}

function keyStateOf(local: MemoKeyInfo | null, server: MemoKeyInfo | null | undefined) {
  if (key && local) return { keyState: 'ready' as const, conflict: !!server && !sameKeyInfo(local, server) }
  return { keyState: local || server ? ('unlock' as const) : ('setup' as const), conflict: false }
}

async function saveKey(k: CryptoKey): Promise<void> {
  key = k
  try {
    await repo.setMeta(CRYPTO_KEY, k)
  } catch {
    // 鍵を保存できないブラウザでは、開いている間だけ使う（次に開いたときにまた合言葉を聞く）
  }
}

/** 全部のメモを復号し直す */
async function openAll(): Promise<Record<string, Memo>> {
  unreadableIds.clear()
  const out: Record<string, Memo> = {}
  if (!key) return out
  for (const sealed of await repo.listMemos()) {
    if (sealed.deleted) continue
    const memo = await openMemo(key, sealed)
    if (memo) out[memo.id] = memo
    else unreadableIds.add(sealed.id)
  }
  return out
}

export const useMemos = create<MemoState>((set, get) => {
  const refresh = async () => {
    const { local, server } = await readKeyInfo()
    set({
      memos: await openAll(),
      unreadable: unreadableIds.size,
      serverChecked: server !== undefined,
      ...keyStateOf(local, server),
    })
  }

  const putLocal = async (sealed: SealedMemo, memo: Memo | null) => {
    await repo.putLocalMemos([sealed])
    set((s) => {
      const memos = { ...s.memos }
      if (memo) memos[memo.id] = memo
      else delete memos[sealed.id]
      return { memos }
    })
    void useJournal.getState().sync()
  }

  return {
    memos: {},
    unreadable: 0,
    keyState: 'loading',
    conflict: false,
    serverChecked: false,

    async load() {
      try {
        key = (await repo.getMeta<CryptoKey>(CRYPTO_KEY)) ?? null
      } catch {
        key = null
      }
      await refresh()
    },

    async create(passphrase) {
      const created = await createKeyInfo(passphrase)
      await repo.setMeta(MEMO_KEY_INFO_KEY, created.info)
      await saveKey(created.key)
      await refresh()
      // 同期先にまだ鍵がなければ、この合言葉が全端末の合言葉になる
      void useJournal.getState().sync()
    },

    async unlock(passphrase) {
      const { local, server } = await readKeyInfo()
      // 同期先に鍵があればそちらに合わせる（全端末で同じ合言葉にする）
      const target = server ?? local
      if (!target) return false
      const next = await unlockKey(passphrase, target)
      if (!next) return false

      // この端末で別の合言葉を使って書いたメモがあれば、同期先の合言葉で暗号化し直す
      const old = key
      if (old && local && !sameKeyInfo(local, target)) {
        const now = new Date().toISOString()
        const resealed: SealedMemo[] = []
        for (const sealed of await repo.listMemos()) {
          if (sealed.deleted || (await openMemo(next, sealed))) continue
          const memo = await openMemo(old, sealed)
          if (memo) resealed.push(await sealMemo(next, { ...memo, updatedAt: now }))
        }
        if (resealed.length > 0) await repo.putLocalMemos(resealed)
      }

      await repo.setMeta(MEMO_KEY_INFO_KEY, target)
      await saveKey(next)
      await refresh()
      void useJournal.getState().sync()
      return true
    },

    async lock() {
      key = null
      await repo.setMeta(CRYPTO_KEY, undefined)
      await refresh()
    },

    async forget() {
      key = null
      await repo.clearMemos()
      await Promise.all(
        [CRYPTO_KEY, MEMO_KEY_INFO_KEY, MEMO_SERVER_KEY].map((k) => repo.setMeta(k, undefined)),
      )
      await refresh()
      void useJournal.getState().sync()
    },

    async add(date, body) {
      if (!key) return
      const now = new Date().toISOString()
      const memo: Memo = {
        id: crypto.randomUUID(),
        date,
        createdAt: now,
        updatedAt: now,
        text: body.text.trim(),
        kind: body.kind,
        ...(body.kind === 'work' && body.mark ? { mark: body.mark } : {}),
      }
      await putLocal(await sealMemo(key, memo), memo)
    },

    async update(id, body) {
      const current = get().memos[id]
      if (!key || !current) return
      const memo: Memo = {
        id,
        date: current.date,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        text: body.text.trim(),
        kind: body.kind,
        ...(body.kind === 'work' && body.mark ? { mark: body.mark } : {}),
      }
      await putLocal(await sealMemo(key, memo), memo)
    },

    async remove(id) {
      const current = get().memos[id]
      if (!current) return
      await putLocal(sealDeleted(current, new Date().toISOString()), null)
    },

    async importSealed(list, info) {
      const { local } = await readKeyInfo()
      if (!local && info) await repo.setMeta(MEMO_KEY_INFO_KEY, info)
      const current = new Map((await repo.listMemos()).map((m) => [m.id, m]))
      const newer = list.filter((m) => {
        const c = current.get(m.id)
        return !c || c.updatedAt < m.updatedAt
      })
      if (newer.length > 0) await repo.putLocalMemos(newer)
      await refresh()
      if (newer.length > 0) void useJournal.getState().sync()
      return newer.length
    },
  }
})

/** 同期で届いたメモを読み、同期先の鍵の状態を反映する */
async function receive(result: MemoSyncResult) {
  const state = useMemos.getState()
  if (state.keyState === 'loading') return
  const memos = { ...state.memos }
  if (key) {
    for (const sealed of result.applied) {
      delete memos[sealed.id]
      unreadableIds.delete(sealed.id)
      if (sealed.deleted) continue
      const memo = await openMemo(key, sealed)
      if (memo) memos[memo.id] = memo
      else unreadableIds.add(sealed.id)
    }
  }
  const { local, server } = await readKeyInfo()
  useMemos.setState({
    memos,
    unreadable: unreadableIds.size,
    serverChecked: server !== undefined,
    ...keyStateOf(local, server),
  })
}

useJournal.subscribe((s, prev) => {
  if (s.memoSync && s.memoSync !== prev.memoSync) void receive(s.memoSync)
})

/** JSONの控えに入れる分（暗号化したままのメモと鍵の材料） */
export async function exportSealed(): Promise<{ memos: SealedMemo[]; memoKey: MemoKeyInfo | null }> {
  const [memos, info] = await Promise.all([repo.listMemos(), repo.getMeta<MemoKeyInfo>(MEMO_KEY_INFO_KEY)])
  return { memos: memos.filter((m) => !m.deleted), memoKey: info ?? null }
}

/** その日のメモ（書いた順） */
export function useMemosOn(date: string): Memo[] {
  const memos = useMemos((s) => s.memos)
  return useMemo(
    () =>
      Object.values(memos)
        .filter((m) => m.date === date)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [memos, date],
  )
}

/** メモのある日 */
export function useMemoDates(): Set<string> {
  const memos = useMemos((s) => s.memos)
  return useMemo(() => new Set(Object.values(memos).map((m) => m.date)), [memos])
}
