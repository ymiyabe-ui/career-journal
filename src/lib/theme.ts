export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'cj-theme'

export function loadTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function saveTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // 保存できなくても表示の切り替えは効かせる
  }
  applyTheme(mode)
}

export function applyTheme(mode: ThemeMode): void {
  const dark =
    mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export type AccentId = 'orange' | 'blue' | 'green' | 'purple' | 'pink'

/** swatch は選択肢の見本の色（ライト時の accent と同じ） */
export const ACCENTS: { id: AccentId; label: string; swatch: string }[] = [
  { id: 'orange', label: 'オレンジ', swatch: 'oklch(0.6 0.17 45)' },
  { id: 'blue', label: 'ブルー', swatch: 'oklch(0.55 0.17 250)' },
  { id: 'green', label: 'グリーン', swatch: 'oklch(0.52 0.14 155)' },
  { id: 'purple', label: 'パープル', swatch: 'oklch(0.55 0.19 300)' },
  { id: 'pink', label: 'ピンク', swatch: 'oklch(0.6 0.19 5)' },
]

const ACCENT_KEY = 'cj-accent'

export function loadAccent(): AccentId {
  try {
    const v = localStorage.getItem(ACCENT_KEY)
    return ACCENTS.some((a) => a.id === v) ? (v as AccentId) : 'orange'
  } catch {
    return 'orange'
  }
}

export function applyAccent(id: AccentId): void {
  if (id === 'orange') delete document.documentElement.dataset.accent
  else document.documentElement.dataset.accent = id
}

/** テーマカラーは端末ごとの好みなので、同期しない */
export function saveAccent(id: AccentId): void {
  try {
    localStorage.setItem(ACCENT_KEY, id)
  } catch {
    // 保存できなくても表示の切り替えは効かせる
  }
  applyAccent(id)
}

/** 端末ごとの小さな設定（入力モードなど）。消えても困らないものだけに使う */
export function loadPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 無視
  }
}
