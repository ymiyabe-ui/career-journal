import { useRef, useState, type ReactNode } from 'react'
import { Check, Download, Monitor, Moon, Sun, Upload } from 'lucide-react'
import { FieldsEditor } from '../components/FieldsEditor'
import { MilestonesEditor } from '../components/MilestonesEditor'
import { ReminderCard } from '../components/ReminderCard'
import { SyncCard } from '../components/SyncCard'
import { Button, Card } from '../components/ui'
import { DAY_START_HOUR } from '../config/fields'
import { downloadBackup, parseBackup } from '../lib/backup'
import { ACCENTS, loadAccent, loadTheme, saveAccent, saveTheme, type AccentId, type ThemeMode } from '../lib/theme'
import { useJournal } from '../store'

const THEMES: { mode: ThemeMode; label: string; icon: ReactNode }[] = [
  { mode: 'system', label: '自動', icon: <Monitor className="size-4" /> },
  { mode: 'light', label: 'ライト', icon: <Sun className="size-4" /> },
  { mode: 'dark', label: 'ダーク', icon: <Moon className="size-4" /> },
]

export function SettingsView({ persisted }: { persisted: boolean | null }) {
  const entries = useJournal((s) => s.entries)
  const importEntries = useJournal((s) => s.importEntries)
  const syncing = useJournal((s) => s.syncConfig !== null)
  const [theme, setTheme] = useState(loadTheme)
  const [accent, setAccent] = useState<AccentId>(loadAccent)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onImport = async (file: File) => {
    try {
      const count = await importEntries(parseBackup(await file.text()))
      setMessage(count > 0 ? `${count}件を読み込みました` : '新しい記録はありませんでした')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '読み込みに失敗しました')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 font-bold">表示</h2>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
          {THEMES.map((t) => (
            <button
              key={t.mode}
              type="button"
              onClick={() => {
                setTheme(t.mode)
                saveTheme(t.mode)
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium ${
                theme === t.mode
                  ? 'bg-white shadow-sm dark:bg-stone-950'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <h3 className="mt-4 mb-2 text-sm font-semibold">テーマカラー</h3>
        <div className="flex gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-label={a.label}
              aria-pressed={accent === a.id}
              title={a.label}
              onClick={() => {
                setAccent(a.id)
                saveAccent(a.id)
              }}
              className={`flex size-10 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-white dark:ring-offset-stone-900 ${
                accent === a.id ? 'ring-2 ring-stone-900 dark:ring-stone-100' : ''
              }`}
              style={{ backgroundColor: a.swatch }}
            >
              {accent === a.id && <Check className="size-5" />}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-stone-500">この端末だけの設定です。</p>
        <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
          1日の区切り：午前{DAY_START_HOUR}時（それより前に書いた分は前日の記録になります）
        </p>
      </Card>

      <FieldsEditor />

      <MilestonesEditor />

      <SyncCard />

      <ReminderCard />

      <Card>
        <h2 className="mb-1 font-bold">データの控え</h2>
        <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
          {syncing
            ? '念のための控えに、JSONで書き出せます。'
            : '記録はこの端末の中だけに保存されています。端末を変えるときや念のための控えに、JSONで書き出してください。'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadBackup(Object.values(entries))}>
            <Download className="size-4" />
            JSONで書き出す
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            JSONを読み込む
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onImport(file)
              e.target.value = ''
            }}
          />
        </div>
        {message && <p className="mt-3 text-sm font-medium text-accent">{message}</p>}
        <p className="mt-3 text-xs text-stone-500">
          読み込むと、同じ日の記録は更新日時が新しいほうを残します。
          {persisted === false &&
            ' この端末では保存領域の保護が許可されていません。ホーム画面に追加すると消えにくくなります。'}
        </p>
      </Card>
    </div>
  )
}
