// import { loadGuestSession, saveGuestSession } from './sessionUtils'

export type ApprovalStatus =
  | 'waitingForPassportImage'
  | 'pending'
  | 'approved'
  | 'rejected'

export interface GuestSession {
  roomNumber: string
  guestName: string
  phone: string
  registrationDate: string    // YYYY-MM-DD
  approvalStatus: ApprovalStatus
  lastUpdated: string
}

// 実装に依存しない関数型を宣言
export type LoadGuestSessionFn = (roomNumber: string, guestName: string) => GuestSession | null
export type SaveGuestSessionFn = (data: GuestSession) => void

/**
 * RoomPageViewコンポーネント用のprops型
 * - 宿泊者情報や画面状態、各種ハンドラーを管理
 */
export interface RoomPageViewProps {
  roomId: string // 部屋番号
  currentStep: 'info' | 'upload' // 現在の画面ステップ

  // 基本情報入力欄
  name: string
  setName: (value: string) => void
  email: string
  setEmail: (value: string) => void
  address: string
  setAddress: (value: string) => void
  phone: string
  setPhone: (value: string) => void
  occupation: string
  setOccupation: (value: string) => void
  nationality: string
  setNationality: (value: string) => void
  checkInDate: Date | null
  setCheckInDate: (value: Date | null) => void
  checkOutDate: Date | null
  setCheckOutDate: (value: Date | null) => void
  promoConsent: boolean
  setPromoConsent: (value: boolean) => void

  // パスポート画像アップロード欄
  passportImageUrl: string | null
  setPassportImageUrl: (url: string | null) => void

  // 画面遷移・登録ハンドラー
  handleNext: () => void
  handleBack: () => void
  handleRegister: (roomId: string, guestName: string) => Promise<void>

  // 画面状態
  isInfoComplete: boolean
  message: string
  client: any // GraphQLクライアント等

  // この部屋の申請状況一覧（任意）
  guestSessions?: GuestSession[]
}

/**
 * 基本情報登録処理用のパラメータ型
 * - GraphQL登録や画面遷移に必要な値をまとめる
 */
export interface HandleNextParams {
  roomId: string
  name: string
  email: string
  address: string
  phone: string
  occupation: string
  nationality: string
  checkInDate: Date | null
  checkOutDate: Date | null
  promoConsent: boolean
  client: any // GraphQLクライアント等
  setMessage: (message: string) => void // メッセージ表示用
  setApprovalStatus: (status: ApprovalStatus) => void // ステータス更新用
  setCurrentStep: (step: 'info' | 'upload') => void // 画面ステップ更新用
}

/**
 * パスポート画像登録処理用のパラメータ型
 * - GraphQL登録やセッション保存に必要な値をまとめる
 */
export interface HandleRegisterParams {
  roomId: string
  name: string
  email: string
  passportImageUrl: string | null
  client: any // GraphQLクライアント等
  setMessage: (message: string) => void // メッセージ表示用
  setApprovalStatus: (status: ApprovalStatus) => void // ステータス更新用
  loadGuestSession: LoadGuestSessionFn // セッション読込関数
  saveGuestSession: SaveGuestSessionFn // セッション保存関数
}

/**
 * パスポートアップロード画面用のprops型
 * - 画面表示・アップロード・画面遷移に必要な値をまとめる
 */
export type PassportUploadScreenProps = {
  roomId: string
  name: string
  client: any
  passportImageUrl: string | null
  setPassportImageUrl: (url: string | null) => void
  onBack: () => void
  onRegister: (roomId: string, guestName: string) => void
}