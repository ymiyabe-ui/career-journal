export interface MilestoneDef {
  threshold: number
  label: string
}

/** 連続記録のバッジ。しきい値と名前はここを変える（設定画面からの編集は Step5） */
export const STREAK_MILESTONES: MilestoneDef[] = [
  { threshold: 3, label: '3日連続' },
  { threshold: 7, label: '1週間マスター' },
  { threshold: 14, label: '2週間の習慣' },
  { threshold: 30, label: '1か月の継続' },
  { threshold: 50, label: '50日の積み上げ' },
  { threshold: 100, label: '100日の達人' },
]

/** 累計記録日数のバッジ。連続が切れても残る */
export const TOTAL_MILESTONES: MilestoneDef[] = [
  { threshold: 10, label: '10日分の記録' },
  { threshold: 30, label: '30日分の記録' },
  { threshold: 50, label: '50日分の記録' },
  { threshold: 100, label: '100日分の記録' },
  { threshold: 365, label: '1年分の記録' },
]

/** 連続N日ごとにお休み券を1枚もらえる */
export const REST_TICKET_EVERY = 7
/** 持てるお休み券の上限 */
export const REST_TICKET_MAX = 2
