import { describe, expect, it } from 'vitest'
import type { Memo } from '../types'
import { createKeyInfo, openMemo, sameKeyInfo, sealDeleted, sealMemo, unlockKey } from './crypto'

// テストでは鍵作りの回数を減らす（本番は 600,000 回）
const ITER = 1000

const memo = (extra: Partial<Memo> = {}): Memo => ({
  id: 'memo-0001-aaaa',
  date: '2026-11-18',
  createdAt: '2026-11-18T01:00:00.000Z',
  updatedAt: '2026-11-18T01:00:00.000Z',
  text: 'A社 初回面談。宿題は資料2点',
  kind: 'work',
  mark: 'todo',
  ...extra,
})

describe('メモの暗号化', () => {
  it('同じ合言葉なら別の端末でも鍵を作り直せ、違う合言葉は弾く', async () => {
    const { info } = await createKeyInfo('いつもの合言葉です', ITER)
    expect(await unlockKey('いつもの合言葉です', info)).not.toBeNull()
    expect(await unlockKey('ちがう合言葉です', info)).toBeNull()
  })

  it('鍵の材料に合言葉そのものは入らない', async () => {
    const { info } = await createKeyInfo('secret-passphrase', ITER)
    expect(JSON.stringify(info)).not.toContain('secret-passphrase')
    expect(info.iter).toBe(ITER)
  })

  it('暗号化したメモは本文が読めず、同じ鍵で元に戻る', async () => {
    const { info, key } = await createKeyInfo('いつもの合言葉です', ITER)
    const sealed = await sealMemo(key, memo())
    expect(JSON.stringify(sealed)).not.toContain('A社')
    expect(JSON.stringify(sealed)).not.toContain('todo')
    expect(sealed.date).toBe('2026-11-18')

    const other = await unlockKey('いつもの合言葉です', info)
    expect(await openMemo(other!, sealed)).toEqual(memo())
  })

  it('別の合言葉の鍵では読めない', async () => {
    const a = await createKeyInfo('合言葉その1です', ITER)
    const b = await createKeyInfo('合言葉その2です', ITER)
    expect(await openMemo(b.key, await sealMemo(a.key, memo()))).toBeNull()
  })

  it('暗号文を別のメモの id に付け替えると読めない', async () => {
    const { key } = await createKeyInfo('いつもの合言葉です', ITER)
    const sealed = await sealMemo(key, memo())
    expect(await openMemo(key, { ...sealed, id: 'memo-0002-bbbb' })).toBeNull()
  })

  it('同じ中身でも暗号化するたびに暗号文が変わる', async () => {
    const { key } = await createKeyInfo('いつもの合言葉です', ITER)
    const a = await sealMemo(key, memo())
    const b = await sealMemo(key, memo())
    expect(a.ct).not.toBe(b.ct)
    expect(a.iv).not.toBe(b.iv)
  })

  it('日常のメモは印なしで戻る', async () => {
    const { key } = await createKeyInfo('いつもの合言葉です', ITER)
    const life = memo({ kind: 'life', mark: undefined, text: '朝の散歩' })
    const opened = await openMemo(key, await sealMemo(key, life))
    expect(opened?.kind).toBe('life')
    expect(opened && 'mark' in opened).toBe(false)
  })

  it('削除の印は中身を残さず、開くと null', async () => {
    const { key } = await createKeyInfo('いつもの合言葉です', ITER)
    const del = sealDeleted(memo(), '2026-11-18T02:00:00.000Z')
    expect(del).toMatchObject({ deleted: true, iv: '', ct: '', updatedAt: '2026-11-18T02:00:00.000Z' })
    expect(await openMemo(key, del)).toBeNull()
  })

  it('sameKeyInfo：同じ材料だけ true', async () => {
    const a = await createKeyInfo('合言葉その1です', ITER)
    const b = await createKeyInfo('合言葉その1です', ITER)
    expect(sameKeyInfo(a.info, { ...a.info })).toBe(true)
    // 同じ合言葉でも salt が違えば別の鍵
    expect(sameKeyInfo(a.info, b.info)).toBe(false)
    expect(sameKeyInfo(a.info, null)).toBe(false)
  })
})
