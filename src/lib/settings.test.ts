import { describe, expect, it } from 'vitest'
import { WINS_FIELD } from '../config/fields'
import type { FieldDef } from '../types'
import {
  activeFields,
  addField,
  defaultSettings,
  hideField,
  moveField,
  normalizeFields,
  parseThresholds,
  renameField,
  sanitizeSettings,
  showField,
  validateLabel,
} from './settings'

const ids = (fields: FieldDef[]) => fields.map((f) => f.id)
const base = () => defaultSettings().fields // wins, learning, nextAction

describe('入力項目の編集', () => {
  it('追加した項目は末尾に付き、IDは決まった形になる', () => {
    const next = addField(base(), '  今日の気分 ')
    expect(next).toHaveLength(4)
    expect(next[3].label).toBe('今日の気分')
    expect(next[3].id).toMatch(/^[A-Za-z][A-Za-z0-9_]{0,39}$/)
    expect(next[3].required).toBeFalsy()
  })

  it('名前を変えてもIDは変わらない', () => {
    const next = renameField(base(), 'learning', '気づき')
    expect(next[1]).toMatchObject({ id: 'learning', label: '気づき' })
  })

  it('隠しても項目は残り、入力欄には出ない。元に戻すと末尾に付く', () => {
    const hidden = hideField(base(), 'learning')
    expect(hidden).toHaveLength(3)
    expect(ids(activeFields({ ...defaultSettings(), fields: hidden }))).toEqual([WINS_FIELD, 'nextAction'])
    expect(ids(showField(hidden, 'learning'))).toEqual([WINS_FIELD, 'nextAction', 'learning'])
  })

  it('同じ名前の隠した項目を「追加」すると、新しく作らず戻す（中身が残っているため）', () => {
    const hidden = hideField(base(), 'learning')
    const next = addField(hidden, '学び・気づき')
    expect(next).toHaveLength(3)
    expect(next.find((f) => f.id === 'learning')?.hidden).toBe(false)
  })

  it('「今日の達成」は隠せず、動かせず、その上にも出られない', () => {
    expect(hideField(base(), WINS_FIELD)).toEqual(base())
    expect(moveField(base(), WINS_FIELD, 1)).toEqual(base())
    expect(moveField(base(), 'learning', -1)).toEqual(base())
  })

  it('並べ替えは隠した項目を飛ばして、見えているとなりと入れ替える', () => {
    const fields = hideField(base(), 'learning') // wins, learning(隠), nextAction
    const withExtra = addField(fields, 'メモ') // wins, learning(隠), nextAction, メモ
    const memo = withExtra[3].id
    const moved = moveField(withExtra, memo, -1)
    // 隠した learning は飛ばして nextAction と入れ替わる
    expect(ids(moved)).toEqual([WINS_FIELD, 'learning', memo, 'nextAction'])
    expect(ids(activeFields({ ...defaultSettings(), fields: moved }))).toEqual([WINS_FIELD, memo, 'nextAction'])
  })

  it('末尾の項目をさらに下へは動かない', () => {
    expect(moveField(base(), 'nextAction', 1)).toEqual(base())
  })

  it('名前の検査', () => {
    const f = base()
    expect(validateLabel('', f)).not.toBeNull()
    expect(validateLabel('あ'.repeat(21), f)).not.toBeNull()
    expect(validateLabel('学び・気づき', f)).not.toBeNull() // 重複
    expect(validateLabel('学び・気づき', f, 'learning')).toBeNull() // 自分自身は重複ではない
    expect(validateLabel('気分', f)).toBeNull()
  })
})

describe('parseThresholds', () => {
  it('並べ替え・重複の除去・全角や読点の許容', () => {
    expect(parseThresholds('14, 3、７ 3')).toEqual({ ok: true, values: [3, 7, 14] })
  })
  it('数字でないもの・範囲外・空・多すぎはエラー', () => {
    expect(parseThresholds('3, abc')).toMatchObject({ ok: false })
    expect(parseThresholds('0')).toMatchObject({ ok: false })
    expect(parseThresholds('10000')).toMatchObject({ ok: false })
    expect(parseThresholds('  ')).toMatchObject({ ok: false })
    expect(parseThresholds('1,2,3,4,5,6,7,8,9,10,11')).toMatchObject({ ok: false })
  })
})

describe('sanitizeSettings', () => {
  const valid = () => ({ ...defaultSettings(), updatedAt: '2026-10-06T10:00:00.000Z' })

  it('正しい設定は通り、「今日の達成」が先頭・必須にそろう', () => {
    const s = sanitizeSettings({ ...valid(), fields: [...valid().fields].reverse() })
    expect(s?.fields[0]).toMatchObject({ id: WINS_FIELD, required: true })
  })

  it('形が合わないものは受け取らない', () => {
    expect(sanitizeSettings(null)).toBeNull()
    expect(sanitizeSettings({ ...valid(), updatedAt: 5 })).toBeNull()
    expect(sanitizeSettings({ ...valid(), fields: [] })).toBeNull()
    expect(sanitizeSettings({ ...valid(), fields: [{ id: '=bad', label: 'x', placeholder: '' }] })).toBeNull()
    expect(sanitizeSettings({ ...valid(), fields: [...valid().fields, valid().fields[0]] })).toBeNull() // id重複
    expect(sanitizeSettings({ ...valid(), streakMilestones: [] })).toBeNull()
    expect(sanitizeSettings({ ...valid(), totalMilestones: [1.5] })).toBeNull()
  })

  it('normalizeFields は「今日の達成」が欠けていても補う', () => {
    expect(normalizeFields([{ id: 'x', label: 'メモ', placeholder: '' }]).map((f) => f.id)).toEqual([WINS_FIELD, 'x'])
  })
})
