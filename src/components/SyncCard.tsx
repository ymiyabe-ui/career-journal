import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { useJournal } from '../store'
import { Button, Card } from './ui'

const INPUT =
  'block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base placeholder:text-stone-400 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:placeholder:text-stone-600'

export function SyncCard() {
  const { syncConfig, syncState, syncMessage, lastSyncedAt, setSyncConfig, sync } = useJournal()
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')

  const validUrl = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url.trim())
  const showForm = !syncConfig || editing

  const startEdit = () => {
    setUrl(syncConfig?.url ?? '')
    setToken(syncConfig?.token ?? '')
    setEditing(true)
  }

  const status =
    syncState === 'syncing'
      ? '同期しています…'
      : syncState === 'error' || syncState === 'offline'
        ? syncMessage
        : lastSyncedAt
          ? `最後の同期：${format(parseISO(lastSyncedAt), 'M/d HH:mm')}`
          : null

  return (
    <Card>
      <h2 className="mb-1 font-bold">スマホとPCの同期</h2>
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
        Googleスプレッドシートを通して、ほかの端末と記録をそろえます。書いた内容はまずこの端末に保存し、裏で送ります。
      </p>

      {showForm ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!validUrl || !token.trim()) return
            setEditing(false)
            void setSyncConfig({ url: url.trim(), token: token.trim() })
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">同期先のURL（GASのWebアプリ）</span>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              className={INPUT}
              placeholder="https://script.google.com/macros/s/…/exec"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {url && !validUrl && (
              <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                「https://script.google.com/macros/s/」で始まり「/exec」で終わるURLを入れてください
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">合言葉</span>
            <input
              type="password"
              autoComplete="new-password"
              className={INPUT}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={!validUrl || !token.trim()}>
              保存して同期する
            </Button>
            {editing && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                やめる
              </Button>
            )}
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void sync()} disabled={syncState === 'syncing'}>
              <RefreshCw className={`size-4 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
              今すぐ同期
            </Button>
            <Button variant="ghost" onClick={startEdit}>
              同期先を変える
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('同期をやめますか？この端末の記録は残ります')) void setSyncConfig(null)
              }}
            >
              同期をやめる
            </Button>
          </div>
          {status && (
            <p
              className={`mt-3 text-sm ${
                syncState === 'error' ? 'font-medium text-red-600 dark:text-red-400' : 'text-stone-500'
              }`}
            >
              {status}
            </p>
          )}
          {syncState === 'idle' && syncMessage && (
            <p className="mt-1 text-sm text-stone-500">{syncMessage}</p>
          )}
        </>
      )}
    </Card>
  )
}
