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
