type ApprovalStatus =
  | 'waitingForBasicInfo'
  | 'waitingForPassportImage'
  | 'pending'
  | 'approved'
  | 'rejected'

export interface GuestSession {
  roomNumber: string
  guestId: string
  guestName: string
  phone: string
  // 以降は任意項目（getGuestで返る可能性のある項目）
  email?: string
  address?: string
  occupation?: string
  nationality?: string
  checkInDate?: string | Date | null
  checkOutDate?: string | Date | null
  promoConsent?: boolean
  passportImageUrl?: string | null
  bookingId?: string
  registrationDate?: string    // YYYY-MM-DD
  approvalStatus: ApprovalStatus
  lastUpdated?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * RoomPageViewコンポーネント用のprops型
 * - 宿泊者情報や画面状態、各種ハンドラーを管理
 */
export interface RoomPageViewProps {
  roomId: string // 部屋番号

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

  // 家族登録関連
  isRepresentativeFamily: boolean
  showFamilyQuestion: boolean
  onFamilyResponse: (isFamily: boolean) => void

  // パスポート画像アップロード欄（統合後はビューでは未使用）

  // 画面遷移・登録ハンドラー
  handleNext: () => void
  handleBack: () => void
  handleRegister: (roomId: string, guestId: string) => Promise<void>

  // 画面状態
  isInfoComplete: boolean
  message: string
  client: any // GraphQLクライアント等

  // この部屋の申請状況一覧（任意）
  guestSessions?: GuestSession[]
  selectedGuest: GuestSession | null
  onSelectGuest: (g: string | GuestSession | null) => void
  onAddGuest: () => void
}

/**
 * 基本情報登録処理用のパラメータ型
 * - GraphQL登録や画面遷移に必要な値をまとめる
 */
export interface HandleNextParams {
  roomId: string
  bookingId: string | null
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
  guestId?: string | null
  selectedGuest?: GuestSession | null 
}

/**
 * パスポート画像登録処理用のパラメータ型
 * - GraphQL登録やセッション保存に必要な値をまとめる
 */
export interface HandleRegisterParams {
  roomId: string
  guestId: string
  passportImageUrl: string | null
  client: any // GraphQLクライアント等
  setMessage: (message: string) => void // メッセージ表示用
}

/**
 * パスポートアップロード画面用のprops型
 * - 画面表示・アップロード・画面遷移に必要な値をまとめる
 */
export type PassportUploadScreenProps = {
  roomId: string
  name: string
  guestId: string
  client: any
  passportImageUrl: string | null
  setPassportImageUrl: (url: string | null) => void
  onBack: () => void
  onRegister: (roomId: string, guestName: string) => void
}