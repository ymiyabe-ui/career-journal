import type { EntryRepository } from '../storage/repository'
import { sameKeyInfo } from '../lib/crypto'
import { sanitizeSettings } from '../lib/settings'
import type { AppSettings, JournalEntry, MemoKeyInfo, SealedMemo } from '../types'

/** 同期先（GAS の Web アプリ）。値は端末の設定画面で入れ、コードには書かない */
export interface SyncConfig {
  url: string
  token: string
}

export interface SyncRequest {
  action: 'sync'
  token: string
  /** 前回の同期でサーバーから受け取った時刻。これより後にサーバーで変わった分を受け取る */
  since: number
  entries: JournalEntry[]
  /** この端末の設定。サーバーのほうが新しければ、応答で新しい設定が返る */
  settings: AppSettings | null
  /** 暗号化したメモ。鍵がサーバーと同じと確かめられたときだけ送る */
  memos: SealedMemo[]
  /** この端末のメモの鍵の材料。サーバーにまだなければ、これが全端末の鍵になる（先に届いたほうを残す） */
  memoKey: MemoKeyInfo | null
}

export interface SyncResponse {
  ok: boolean
  error?: string
  serverTime?: number
  entries?: JournalEntry[]
  rejected?: number
  settings?: AppSettings | null
  /** メモに対応した同期先だけが返す。無ければ古い版の同期先 */
  memos?: SealedMemo[]
  memoKey?: MemoKeyInfo | null
  memoRejected?: number
}

export type Transport = (config: SyncConfig, body: SyncRequest) => Promise<SyncResponse>

export class SyncError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: '合言葉が違います',
  bad_request: '同期先が要求を読めませんでした',
  unknown_action: '同期先のバージョンが合っていません',
}

export const CURSOR_KEY = 'syncCursor'
export const SETTINGS_KEY = 'settings'
/** この端末のメモの鍵の材料（MemoKeyInfo） */
export const MEMO_KEY_INFO_KEY = 'memoKeyInfo'
/** 同期先にあるメモの鍵の材料。null＝同期先にまだ無い、undefined＝メモに対応した同期先とまだ同期していない */
export const MEMO_SERVER_KEY = 'memoKeyServer'

/**
 * メモの同期の結果。
 * - unsupported：同期先が古い版で、メモを扱えない（メモはこの端末にだけ残る）
 * - nokey：この端末でまだ合言葉を決めていない（届いたメモは暗号化したまま保存する）
 * - ok：鍵が同期先と同じ
 * - conflict：別の端末で先に決めた合言葉と違う。メモは送らずに手元に残す
 */
export type MemoSyncStatus = 'unsupported' | 'nokey' | 'ok' | 'conflict'

export interface MemoSyncResult {
  status: MemoSyncStatus
  applied: SealedMemo[]
  serverKey: MemoKeyInfo | null
  rejected: number
  /** 鍵が同期先と同じと分かったばかりで、まだ送っていないメモがある。もう一度同期する */
  resend: boolean
}

/**
 * 未送信の記録を送り、サーバー側で増えた・変わった記録を受け取る。
 * 受け取った記録は手元より新しいものだけ保存し、保存したものを返す。
 */
export async function runSync(
  repo: EntryRepository,
  config: SyncConfig,
  transport: Transport,
): Promise<{
  applied: JournalEntry[]
  pushed: number
  rejected: number
  settings: AppSettings | null
  memos: MemoSyncResult
}> {
  const before = new Map((await repo.list()).map((e) => [e.id, e]))
  const pending = (await repo.pendingIds())
    .map((id) => before.get(id))
    .filter((e): e is JournalEntry => !!e)
  const since = (await repo.getMeta<number>(CURSOR_KEY)) ?? 0
  const localSettings = sanitizeSettings(await repo.getMeta<unknown>(SETTINGS_KEY))

  // メモは、この端末の鍵が同期先の鍵と同じと分かっているときだけ送る。
  // 違う鍵で暗号化したメモを送ると、ほかの端末では読めないため
  const localKey = (await repo.getMeta<MemoKeyInfo>(MEMO_KEY_INFO_KEY)) ?? null
  const knownServerKey = await repo.getMeta<MemoKeyInfo | null>(MEMO_SERVER_KEY)
  const canSendMemos = sameKeyInfo(localKey, knownServerKey)
  const memosBefore = new Map((await repo.listMemos()).map((m) => [m.id, m]))
  const pendingMemos = canSendMemos
    ? (await repo.pendingMemoIds()).map((id) => memosBefore.get(id)).filter((m): m is SealedMemo => !!m)
    : []

  const res = await transport(config, {
    action: 'sync',
    token: config.token,
    since,
    entries: pending,
    // 一度も変えていない設定（updatedAt が空）は送らない
    settings: localSettings && localSettings.updatedAt !== '' ? localSettings : null,
    memos: pendingMemos,
    memoKey: localKey,
  })
  if (!res.ok || typeof res.serverTime !== 'number') {
    const code = res.error ?? 'unknown'
    throw new SyncError(code, ERROR_MESSAGES[code] ?? `同期に失敗しました（${code}）`)
  }

  const applied = await repo.putRemote(res.entries ?? [])

  // 送っている間に書き直した記録は印を残し、次の同期でもう一度送る
  const after = new Map((await repo.list()).map((e) => [e.id, e]))
  await repo.clearPending(
    pending.filter((e) => after.get(e.id)?.updatedAt === e.updatedAt).map((e) => e.id),
  )
  await repo.setMeta(CURSOR_KEY, res.serverTime)

  // サーバーの設定のほうが新しければ取り込む。送っている間に手元で直した分は、手元を残す
  let appliedSettings: AppSettings | null = null
  const remote = sanitizeSettings(res.settings)
  if (remote) {
    const current = sanitizeSettings(await repo.getMeta<unknown>(SETTINGS_KEY))
    if (!current || current.updatedAt < remote.updatedAt) {
      await repo.setMeta(SETTINGS_KEY, remote)
      appliedSettings = remote
    }
  }

  const memos = await applyMemoResponse(repo, res, localKey, canSendMemos, pendingMemos)

  return { applied, pushed: pending.length, rejected: res.rejected ?? 0, settings: appliedSettings, memos }
}

async function applyMemoResponse(
  repo: EntryRepository,
  res: SyncResponse,
  localKey: MemoKeyInfo | null,
  sent: boolean,
  sentMemos: SealedMemo[],
): Promise<MemoSyncResult> {
  if (!Array.isArray(res.memos)) {
    return { status: 'unsupported', applied: [], serverKey: null, rejected: 0, resend: false }
  }
  // 届いたメモは、鍵があってもなくても暗号化したまま保存する（読むのは合言葉を入れたあと）
  const applied = await repo.putRemoteMemos(res.memos)
  const afterMemos = new Map((await repo.listMemos()).map((m) => [m.id, m]))
  await repo.clearPendingMemos(
    sentMemos.filter((m) => afterMemos.get(m.id)?.updatedAt === m.updatedAt).map((m) => m.id),
  )

  const serverKey = res.memoKey ?? null
  await repo.setMeta(MEMO_SERVER_KEY, serverKey)
  const status: MemoSyncStatus = !localKey ? 'nokey' : sameKeyInfo(localKey, serverKey) ? 'ok' : 'conflict'
  const resend = !sent && status === 'ok' && (await repo.pendingMemoIds()).length > 0
  return { status, applied, serverKey, rejected: res.memoRejected ?? 0, resend }
}

/** GAS へ text/plain で POST する（プリフライトを起こさないため） */
export const fetchTransport: Transport = async (config, body) => {
  let res: Response
  try {
    res = await fetch(config.url, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' })
  } catch {
    throw new SyncError('offline', 'つながらないため、あとで同期します')
  }
  if (!res.ok) throw new SyncError('http', `同期先がエラーを返しました（${res.status}）`)
  try {
    return (await res.json()) as SyncResponse
  } catch {
    throw new SyncError('not_json', '同期先の応答を読めませんでした。URLを確かめてください')
  }
}
