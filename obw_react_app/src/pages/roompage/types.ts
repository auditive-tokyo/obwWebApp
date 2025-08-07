import type { ApprovalStatus } from './sessionUtils'
import { loadGuestSession, saveGuestSession } from './sessionUtils'

// RoomPageView用の型
export interface RoomPageViewProps {
  roomId: string
  approvalStatus: ApprovalStatus
  currentStep: 'info' | 'upload'
  
  // Info step props
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
  checkInDate: string
  setCheckInDate: (value: string) => void
  checkOutDate: string
  setCheckOutDate: (value: string) => void
  promoConsent: boolean
  setPromoConsent: (value: boolean) => void
  
  // Upload step props
  passportImageUrl: string
  setPassportImageUrl: (url: string) => void
  
  // Handlers
  handleNext: () => void
  handleBack: () => void
  handleRegister: () => void
  
  // State
  isInfoComplete: boolean
  message: string
  client: any
}

// ハンドラー用の型
export interface HandleNextParams {
  roomId: string
  name: string
  address: string
  phone: string
  occupation: string
  nationality: string
  checkInDate: string
  checkOutDate: string
  promoConsent: boolean
  client: any
  setMessage: (message: string) => void
  setApprovalStatus: (status: ApprovalStatus) => void
  setCurrentStep: (step: 'info' | 'upload') => void
}

export interface HandleRegisterParams {
  roomId: string
  name: string
  passportImageUrl: string
  client: any
  setMessage: (message: string) => void
  setApprovalStatus: (status: ApprovalStatus) => void
  loadGuestSession: typeof loadGuestSession
  saveGuestSession: typeof saveGuestSession
}