import type { ApprovalStatus } from './sessionUtils'
import { loadGuestSession, saveGuestSession } from './sessionUtils'

/**
 * RoomPageViewコンポーネント用のprops型
 * - 宿泊者情報や画面状態、各種ハンドラーを管理
 */
export interface RoomPageViewProps {
  roomId: string // 部屋番号
  approvalStatus: ApprovalStatus // 承認ステータス
  currentStep: 'info' | 'upload' // 現在の画面ステップ

  // 基本情報入力欄
  name: string
  setName: (value: string) => void
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
  passportImageUrl: string
  setPassportImageUrl: (url: string) => void

  // 画面遷移・登録ハンドラー
  handleNext: () => void
  handleBack: () => void
  handleRegister: () => void

  // 画面状態
  isInfoComplete: boolean
  message: string
  client: any // GraphQLクライアント等
}

/**
 * 基本情報登録処理用のパラメータ型
 * - GraphQL登録や画面遷移に必要な値をまとめる
 */
export interface HandleNextParams {
  roomId: string
  name: string
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
  passportImageUrl: string
  client: any // GraphQLクライアント等
  setMessage: (message: string) => void // メッセージ表示用
  setApprovalStatus: (status: ApprovalStatus) => void // ステータス更新用
  loadGuestSession: typeof loadGuestSession // セッション読込関数
  saveGuestSession: typeof saveGuestSession // セッション保存関数
}

/**
 * パスポートアップロード画面用のprops型
 * - 画面表示・アップロード・画面遷移に必要な値をまとめる
 */
export interface PassportUploadScreenProps {
  roomId: string // 部屋番号
  name: string // 宿泊者名
  client: any // GraphQLクライアント等
  passportImageUrl: string // アップロード済み画像URL
  setPassportImageUrl: (url: string) => void // 画像URL更新用
  onBack: () => void // 戻るボタン用
  onRegister: () => void // 登録完了ボタン用
}