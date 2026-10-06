import { useState, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Plus } from 'lucide-react'
import { WINS_FIELD } from '../config/fields'
import {
  addField,
  hideField,
  MAX_FIELDS,
  MAX_LABEL,
  moveField,
  renameField,
  showField,
  validateLabel,
} from '../lib/settings'
import { useJournal } from '../store'
import { Button, Card } from './ui'

const INPUT =
  'block w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base placeholder:text-stone-400 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:placeholder:text-stone-600'

const ICON_BUTTON = 'px-2 py-2'

export function FieldsEditor() {
  const settings = useJournal((s) => s.settings)
  const updateSettings = useJournal((s) => s.updateSettings)
  const [error, setError] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')

  const fields = settings.fields
  const visible = fields.filter((f) => !f.hidden)
  const hidden = fields.filter((f) => f.hidden)

  const change = (fn: (f: typeof fields) => typeof fields) => {
    setError(null)
    void updateSettings((s) => ({ ...s, fields: fn(s.fields) }))
  }

  const commitRename = (id: string, current: string, input: HTMLInputElement) => {
    if (input.value.trim() === current) return
    const problem = validateLabel(input.value, fields, id)
    if (problem) {
      setError(problem)
      input.value = current
      return
    }
    change((f) => renameField(f, id, input.value))
  }

  const submitNew = () => {
    const problem = validateLabel(newLabel, fields.filter((f) => !f.hidden))
    if (problem) return setError(problem)
    const restoring = fields.some((f) => f.hidden && f.label === newLabel.trim())
    if (!restoring && fields.length >= MAX_FIELDS) return setError(`項目は${MAX_FIELDS}個までです`)
    change((f) => addField(f, newLabel))
    setNewLabel('')
  }

  return (
    <Card>
      <h2 className="mb-1 font-bold">入力項目</h2>
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
        記録に書く項目を変えられます。隠した項目の記録は消えず、あとで戻せます。スマホとPCで同じになります。
      </p>

      <ul className="space-y-2">
        {visible.map((f) => {
          const isWins = f.id === WINS_FIELD
          return (
            <li key={f.id} className="flex items-center gap-1">
              {isWins ? (
                <span className="flex w-[4.5rem] shrink-0 justify-center text-stone-400" title="先頭に固定・必須">
                  <Lock className="size-4" />
                </span>
              ) : (
                <span className="flex shrink-0">
                  <Button
                    variant="ghost"
                    className={ICON_BUTTON}
                    aria-label={`${f.label}を上へ`}
                    disabled={moveField(fields, f.id, -1) === fields}
                    onClick={() => change((all) => moveField(all, f.id, -1))}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className={ICON_BUTTON}
                    aria-label={`${f.label}を下へ`}
                    disabled={moveField(fields, f.id, 1) === fields}
                    onClick={() => change((all) => moveField(all, f.id, 1))}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </span>
              )}
              <input
                key={`${f.id}:${f.label}`}
                className={INPUT}
                defaultValue={f.label}
                maxLength={MAX_LABEL}
                aria-label={`項目の名前：${f.label}`}
                onBlur={(e) => commitRename(f.id, f.label, e.currentTarget)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              {!isWins && (
                <Button
                  variant="ghost"
                  className={ICON_BUTTON}
                  aria-label={`${f.label}を隠す`}
                  onClick={() => change((all) => hideField(all, f.id))}
                >
                  <EyeOff className="size-4" />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
        「{visible[0]?.label}」は先頭に固定で、必須です（連続記録と達成の数の元になります）。
      </p>

      {hidden.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold">隠している項目</h3>
          <ul className="space-y-1">
            {hidden.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-xl bg-stone-100 px-3 py-1.5 dark:bg-stone-800">
                <span className="text-sm text-stone-600 dark:text-stone-300">{f.label}</span>
                <Button
                  variant="ghost"
                  className="px-2 py-1.5"
                  onClick={() => change((all) => showField(all, f.id))}
                >
                  <Eye className="size-4" />
                  表示する
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submitNew()
        }}
      >
        <input
          className={INPUT}
          value={newLabel}
          maxLength={MAX_LABEL}
          placeholder="項目を足す（例：今日の気分）"
          aria-label="足す項目の名前"
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <Button type="submit" disabled={newLabel.trim() === ''} className="shrink-0">
          <Plus className="size-4" />
          足す
        </Button>
      </form>

      {error && (
        <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </Card>
  )
}
