import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import type { FieldDef } from '../types'
import { Button } from './ui'

interface Props {
  fields: FieldDef[]
  initial?: Record<string, string>
  /** 1行モード：必須項目だけを出す */
  minimal: boolean
  autoFocus?: boolean
  submitLabel?: string
  onSubmit(values: Record<string, string>): void
  onCancel?(): void
}

export function EntryForm({
  fields,
  initial = {},
  minimal,
  autoFocus,
  submitLabel = '記録する',
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(initial)
  const visible = minimal ? fields.filter((f) => f.required) : fields
  const canSubmit = fields.filter((f) => f.required).every((f) => values[f.id]?.trim())

  const submit = () => {
    // 1行モードで隠れている項目も、すでに書いてある内容は残す
    if (canSubmit) onSubmit({ ...initial, ...values })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {visible.map((f, i) => (
        <label key={f.id} className="block">
          <span className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold">
            {f.label}
            {f.required && <span className="text-xs font-normal text-accent">必須</span>}
          </span>
          <AutoTextarea
            value={values[f.id] ?? ''}
            placeholder={f.placeholder}
            autoFocus={autoFocus && i === 0}
            onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))}
            onKeyDown={onKeyDown}
          />
        </label>
      ))}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit} className="flex-1 py-3 text-base">
          <Check className="size-5" />
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            やめる
          </Button>
        )}
      </div>
    </form>
  )
}

function AutoTextarea({
  value,
  placeholder,
  autoFocus,
  onChange,
  onKeyDown,
}: {
  value: string
  placeholder: string
  autoFocus?: boolean
  onChange(v: string): void
  onKeyDown(e: KeyboardEvent): void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className="block w-full resize-none overflow-hidden rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base leading-relaxed placeholder:text-stone-400 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:placeholder:text-stone-600"
    />
  )
}
