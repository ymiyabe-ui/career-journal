import type { Memo, MemoBody, MemoKeyInfo, SealedMemo } from '../types'

/**
 * メモの暗号化。ブラウザ標準の Web Crypto だけを使う。
 * 合言葉 → PBKDF2（SHA-256）で鍵 → AES-GCM（256bit）。合言葉はどこにも保存・送信しない。
 * 鍵は取り出せない形（extractable: false）で作り、端末の中にだけ置く。
 */

/** PBKDF2 の回数。スマホで1秒弱。鍵を作るのは端末ごとに1回だけ */
export const DEFAULT_ITERATIONS = 600_000

/** 合言葉の最低文字数 */
export const MIN_PASSPHRASE = 8

const VERIFIER_TEXT = 'career-journal-memo-v1'
const VERIFIER_AAD = 'verifier'

const enc = new TextEncoder()
const dec = new TextDecoder()

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encrypt(key: CryptoKey, plain: string, aad: string): Promise<{ iv: string; ct: string }> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
    key,
    enc.encode(plain),
  )
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) }
}

/** 鍵が違う・中身が壊れているときは null */
async function decrypt(key: CryptoKey, iv: string, ct: string, aad: string): Promise<string | null> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv), additionalData: enc.encode(aad) },
      key,
      fromBase64(ct),
    )
    return dec.decode(plain)
  } catch {
    return null
  }
}

/** 新しい合言葉から鍵と、ほかの端末で確かめるための材料を作る */
export async function createKeyInfo(
  passphrase: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<{ info: MemoKeyInfo; key: CryptoKey }> {
  const salt = randomBytes(16)
  const key = await deriveKey(passphrase, salt, iterations)
  const check = await encrypt(key, VERIFIER_TEXT, VERIFIER_AAD)
  return { info: { v: 1, salt: toBase64(salt), iter: iterations, ...check }, key }
}

/** 合言葉から鍵を作り直す。合言葉が違えば null */
export async function unlockKey(passphrase: string, info: MemoKeyInfo): Promise<CryptoKey | null> {
  const key = await deriveKey(passphrase, fromBase64(info.salt), info.iter)
  return (await decrypt(key, info.iv, info.ct, VERIFIER_AAD)) === VERIFIER_TEXT ? key : null
}

/** 同じ合言葉・同じ鍵で作られた材料か */
export function sameKeyInfo(a: MemoKeyInfo | null | undefined, b: MemoKeyInfo | null | undefined): boolean {
  return !!a && !!b && a.salt === b.salt && a.iter === b.iter && a.iv === b.iv && a.ct === b.ct
}

/** メモの id を暗号文に結びつける（別のメモの暗号文と入れ替えられても読めないように） */
const memoAad = (id: string) => `memo:${id}`

export async function sealMemo(key: CryptoKey, memo: Memo): Promise<SealedMemo> {
  const body: MemoBody = { text: memo.text, kind: memo.kind, ...(memo.mark ? { mark: memo.mark } : {}) }
  const { iv, ct } = await encrypt(key, JSON.stringify(body), memoAad(memo.id))
  return { id: memo.id, date: memo.date, createdAt: memo.createdAt, updatedAt: memo.updatedAt, iv, ct }
}

/** 削除の印。中身は残さない */
export function sealDeleted(memo: Pick<SealedMemo, 'id' | 'date' | 'createdAt'>, now: string): SealedMemo {
  return { id: memo.id, date: memo.date, createdAt: memo.createdAt, updatedAt: now, deleted: true, iv: '', ct: '' }
}

const KINDS = ['work', 'life']
const MARKS = ['done', 'doing', 'todo', 'ask']

/** 復号する。削除済み・鍵が違う・形がおかしいものは null */
export async function openMemo(key: CryptoKey, sealed: SealedMemo): Promise<Memo | null> {
  if (sealed.deleted || !sealed.iv || !sealed.ct) return null
  const plain = await decrypt(key, sealed.iv, sealed.ct, memoAad(sealed.id))
  if (plain === null) return null
  try {
    const body = JSON.parse(plain) as Partial<MemoBody>
    if (typeof body.text !== 'string' || !KINDS.includes(String(body.kind))) return null
    return {
      id: sealed.id,
      date: sealed.date,
      createdAt: sealed.createdAt,
      updatedAt: sealed.updatedAt,
      text: body.text,
      kind: body.kind as MemoBody['kind'],
      ...(body.mark && MARKS.includes(body.mark) ? { mark: body.mark } : {}),
    }
  } catch {
    return null
  }
}
