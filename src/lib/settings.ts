import { DEFAULT_FIELDS, WINS_FIELD } from '../config/fields'
import { DEFAULT_THRESHOLDS } from '../config/milestones'
import type { AppSettings, FieldDef } from '../types'

export const MAX_FIELDS = 12
export const MAX_LABEL = 20
export const MAX_THRESHOLDS = 10
export const MAX_THRESHOLD_VALUE = 9999

const FIELD_ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/

export function defaultSettings(): AppSettings {
  return {
    fields: DEFAULT_FIELDS.map((f) => ({ ...f })),
    streakMilestones: [...DEFAULT_THRESHOLDS.streak],
    totalMilestones: [...DEFAULT_THRESHOLDS.total],
    updatedAt: '',
  }
}

/** 入力欄に出す項目（隠していないもの） */
export function activeFields(settings: AppSettings): FieldDef[] {
  return settings.fields.filter((f) => !f.hidden)
}

/** 「今日の達成」を先頭・必須・表示にそろえ、ほかの項目は必須を外す */
export function normalizeFields(fields: FieldDef[]): FieldDef[] {
  const wins = fields.find((f) => f.id === WINS_FIELD) ?? DEFAULT_FIELDS[0]
  const rest = fields.filter((f) => f.id !== WINS_FIELD).map((f) => ({ ...f, required: false }))
  return [{ ...wins, required: true, hidden: false }, ...rest]
}

// ---- 入力項目の編集（どれも新しい配列を返す） ----

/** 表示名の問題を日本語で返す。なければ null */
export function validateLabel(label: string, fields: FieldDef[], exceptId?: string): string | null {
  const t = label.trim()
  if (t === '') return '項目の名前を入れてください'
  if (t.length > MAX_LABEL) return `名前は${MAX_LABEL}文字までです`
  if (fields.some((f) => f.id !== exceptId && !f.hidden && f.label === t)) return '同じ名前の項目がすでにあります'
  return null
}

function newFieldId(fields: FieldDef[]): string {
  const used = new Set(fields.map((f) => f.id))
  for (;;) {
    const id = `f_${Math.random().toString(36).slice(2, 8)}`
    if (!used.has(id)) return id
  }
}

/** 同じ名前の隠した項目があれば、新しく作らずそれを表示に戻す（中身が残っているため） */
export function addField(fields: FieldDef[], label: string): FieldDef[] {
  const t = label.trim()
  const hidden = fields.find((f) => f.hidden && f.label === t)
  if (hidden) return showField(fields, hidden.id)
  return [...fields, { id: newFieldId(fields), label: t, placeholder: '' }]
}

export function renameField(fields: FieldDef[], id: string, label: string): FieldDef[] {
  return fields.map((f) => (f.id === id ? { ...f, label: label.trim() } : f))
}

/** 隠す。記録の中身は消さない。「今日の達成」は隠せない */
export function hideField(fields: FieldDef[], id: string): FieldDef[] {
  if (id === WINS_FIELD) return fields
  return fields.map((f) => (f.id === id ? { ...f, hidden: true } : f))
}

/** 表示に戻す。並びの最後に付ける */
export function showField(fields: FieldDef[], id: string): FieldDef[] {
  const target = fields.find((f) => f.id === id)
  if (!target) return fields
  return [...fields.filter((f) => f.id !== id), { ...target, hidden: false }]
}

/** 表示中の項目のなかで1つ上・下へ動かす。「今日の達成」は動かせず、その上にも出られない */
export function moveField(fields: FieldDef[], id: string, dir: -1 | 1): FieldDef[] {
  const i = fields.findIndex((f) => f.id === id)
  if (i <= 0) return fields
  let j = i + dir
  while (j > 0 && j < fields.length && fields[j].hidden) j += dir
  if (j <= 0 || j >= fields.length) return fields
  const next = [...fields]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

// ---- バッジのしきい値 ----

export type ParseResult = { ok: true; values: number[] } | { ok: false; error: string }

/** 「3, 7, 14」のような入力を数字の配列にする。全角の数字・読点・空白も受け付ける */
export function parseThresholds(text: string): ParseResult {
  const half = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  const parts = half.split(/[,、，\s]+/).filter(Boolean)
  if (parts.length === 0) return { ok: false, error: '数字を1つ以上入れてください' }
  const values: number[] = []
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return { ok: false, error: `「${p}」は数字ではありません` }
    const n = Number(p)
    if (n < 1 || n > MAX_THRESHOLD_VALUE) return { ok: false, error: `1〜${MAX_THRESHOLD_VALUE}の数字にしてください` }
    values.push(n)
  }
  const unique = [...new Set(values)].sort((a, b) => a - b)
  if (unique.length > MAX_THRESHOLDS) return { ok: false, error: `${MAX_THRESHOLDS}個までです` }
  return { ok: true, values: unique }
}

// ---- 同期で受け取った設定の検査 ----

function sanitizeThresholds(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_THRESHOLDS) return null
  if (!raw.every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_THRESHOLD_VALUE)) return null
  return [...new Set(raw as number[])].sort((a, b) => a - b)
}

/** 形の合わないものは null（受け取らない）。通ったものは整えて返す */
export function sanitizeSettings(raw: unknown): AppSettings | null {
  const s = raw as Partial<AppSettings> | null
  if (!s || typeof s !== 'object' || typeof s.updatedAt !== 'string') return null
  if (!Array.isArray(s.fields) || s.fields.length === 0 || s.fields.length > MAX_FIELDS) return null
  const fields: FieldDef[] = []
  for (const f of s.fields) {
    if (!f || typeof f.id !== 'string' || !FIELD_ID_RE.test(f.id)) return null
    if (typeof f.label !== 'string' || f.label.trim() === '' || f.label.length > 40) return null
    if (fields.some((x) => x.id === f.id)) return null
    fields.push({
      id: f.id,
      label: f.label,
      placeholder: typeof f.placeholder === 'string' ? f.placeholder : '',
      ...(f.hidden === true ? { hidden: true } : {}),
    })
  }
  const streak = sanitizeThresholds(s.streakMilestones)
  const total = sanitizeThresholds(s.totalMilestones)
  if (!streak || !total) return null
  return { fields: normalizeFields(fields), streakMilestones: streak, totalMilestones: total, updatedAt: s.updatedAt }
}
