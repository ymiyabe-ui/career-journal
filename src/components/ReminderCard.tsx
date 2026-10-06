import { BellRing } from 'lucide-react'
import { useJournal } from '../store'
import { Card } from './ui'

/** リマインドは同期サーバー（GAS）が送るメール。時刻はアプリからは変えられないので、変え方を案内する */
export function ReminderCard() {
  const syncing = useJournal((s) => s.syncConfig !== null)
  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-1.5 font-bold">
        <BellRing className="size-4 text-accent" />
        リマインドメール
      </h2>
      {syncing ? (
        <>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            毎晩21時台に、その日の記録がまだなければ、同期先のGoogleアカウントにメールが届きます。
          </p>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            時刻を変えるには、同期サーバー（GAS）のスクリプトプロパティ <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">REMIND_HOUR</code>{' '}
            を変えてから、関数 <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">setupReminder</code>{' '}
            を実行します。手順はリポジトリの gas/README.md にあります。
          </p>
        </>
      ) : (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          同期を設定すると、その日の記録がまだない夜に、同期先のGoogleアカウントへメールでお知らせできます。
        </p>
      )}
    </Card>
  )
}
