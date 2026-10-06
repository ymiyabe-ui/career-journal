import type { FieldDef } from '../types'

/** 入力項目の定義。並べ替え・追加はここを変える（設定画面からの編集は Step5） */
export const DEFAULT_FIELDS: FieldDef[] = [
  {
    id: 'wins',
    label: '今日の達成',
    placeholder: '小さなことでOK。例：見積もりを1本出した',
    required: true,
  },
  {
    id: 'learning',
    label: '学び・気づき',
    placeholder: '例：先に結論を言うと会議が短くなる',
  },
  {
    id: 'nextAction',
    label: '明日やる1アクション',
    placeholder: '例：A社に日程候補を送る',
  },
]

/** 1日の区切り（時）。深夜にこの時刻より前に書いた分は前日の記録になる */
export const DAY_START_HOUR = 4
