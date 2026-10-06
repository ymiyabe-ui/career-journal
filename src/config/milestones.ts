/** バッジのしきい値。設定画面で変えられる（既定はここ） */
export interface Thresholds {
  streak: number[]
  total: number[]
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  streak: [3, 7, 14, 30, 50, 100],
  total: [10, 30, 50, 100, 365],
}

const STREAK_NAMES: Record<number, string> = {
  3: '3日連続',
  7: '1週間マスター',
  14: '2週間の習慣',
  30: '1か月の継続',
  50: '50日の積み上げ',
  100: '100日の達人',
}

const TOTAL_NAMES: Record<number, string> = {
  10: '10日分の記録',
  30: '30日分の記録',
  50: '50日分の記録',
  100: '100日分の記録',
  365: '1年分の記録',
}

/** 名前が決まっているしきい値はその名前、それ以外は「N日連続」の形 */
export function streakLabel(threshold: number): string {
  return STREAK_NAMES[threshold] ?? `${threshold}日連続`
}

export function totalLabel(threshold: number): string {
  return TOTAL_NAMES[threshold] ?? `${threshold}日分の記録`
}

export interface MilestoneDef {
  threshold: number
  label: string
}

/** 連続N日ごとにお休み券を1枚もらえる */
export const REST_TICKET_EVERY = 7
/** 持てるお休み券の上限 */
export const REST_TICKET_MAX = 2
