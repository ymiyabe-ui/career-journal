export const SCHEMA_VERSION = 1

/**
 * 1日1件の記録。id は date と同じ値にする。
 * スマホとPCで同じ日を別々に書いても、同期のときに同じ記録として扱えるようにするため。
 */
export interface JournalEntry {
  id: string
  /** 記録の対象日（YYYY-MM-DD）。1日の区切りは dayStartHour で決まる */
  date: string
  /** 入力項目ID → 本文。項目は config/fields.ts の定義で増減できる */
  fields: Record<string, string>
  createdAt: string
  updatedAt: string
  /** 削除の印。同期のときに他の端末へ削除を伝えるため、実際には消さない */
  deleted?: boolean
  schemaVersion: number
}

export interface FieldDef {
  id: string
  label: string
  placeholder: string
  required?: boolean
  /** 画面から隠す。過去の記録の中身は残る */
  hidden?: boolean
}

/** 端末をまたいで同期する設定 */
export interface AppSettings {
  /** 先頭は必ず「今日の達成」（id は WINS_FIELD） */
  fields: FieldDef[]
  streakMilestones: number[]
  totalMilestones: number[]
  /** 変更した時刻。新しいほうを残す。初期値は空文字 */
  updatedAt: string
}

export interface Stats {
  currentStreak: number
  longestStreak: number
  totalEntries: number
  monthEntries: number
  lastEntryDate: string | null
  todayDone: boolean
  /** 残っているお休み券（いま休み中の分を引いたあと） */
  restTickets: number
  /** いま休み中の日数。今日書けばお休み券で埋まる */
  restPending: number
  /** これまでに使ったお休み券の枚数 */
  restUsed: number
}

/** メモの種類。日報にまとめるのは「仕事」だけ */
export type MemoKind = 'work' | 'life'

/** 仕事のメモに付ける印。日報の見出しになる */
export type MemoMark = 'done' | 'doing' | 'todo' | 'ask'

/** メモの中身。保存・同期のときはこの部分を暗号化する */
export interface MemoBody {
  text: string
  kind: MemoKind
  mark?: MemoMark
}

/** 画面で扱うメモ（復号したもの） */
export interface Memo extends MemoBody {
  /** ランダムな id。1日に何件でも書ける */
  id: string
  /** メモの対象日（YYYY-MM-DD）。1日の区切りは日記と同じ */
  date: string
  createdAt: string
  updatedAt: string
}

/**
 * 保存・同期するときのメモ。中身（text・kind・mark）は ct に暗号化して入れる。
 * 日付と時刻は同期の差分に使うので暗号化しない。削除したメモは iv・ct を空にして中身を残さない
 */
export interface SealedMemo {
  id: string
  date: string
  createdAt: string
  updatedAt: string
  deleted?: boolean
  /** AES-GCM の初期化ベクトル（base64） */
  iv: string
  /** 暗号文（base64） */
  ct: string
}

/**
 * メモの鍵を作るための材料。合言葉そのものは含まない。
 * salt と回数は鍵を作り直すのに使い、iv・ct は合言葉が合っているかの確かめ用の暗号文
 */
export interface MemoKeyInfo {
  v: 1
  salt: string
  iter: number
  iv: string
  ct: string
}

export interface Badge {
  id: string
  kind: 'streak' | 'total'
  threshold: number
  label: string
  /** 獲得した日。未獲得は null */
  earnedOn: string | null
}
