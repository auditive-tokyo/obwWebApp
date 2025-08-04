import { PassportUpload } from './PassportUpload'
import ChatWidget from '../../components/ChatWidget'
import type { ApprovalStatus } from './sessionUtils'

interface RoomPageViewProps {
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

export function RoomPageView(props: RoomPageViewProps) {
  const {
    roomId,
    approvalStatus,
    currentStep,
    name,
    setName,
    address,
    setAddress,
    phone,
    setPhone,
    occupation,
    setOccupation,
    nationality,
    setNationality,
    checkInDate,
    setCheckInDate,
    checkOutDate,
    setCheckOutDate,
    promoConsent,
    setPromoConsent,
    passportImageUrl,
    setPassportImageUrl,
    handleNext,
    handleBack,
    handleRegister,
    isInfoComplete,
    message,
    client
  } = props

  return (
    <div className="container mx-auto p-4">
      <p>{roomId}号室のページです。</p>
      <p>現在のステータス: {approvalStatus}</p>
      
      {currentStep === 'info' && (
        <div className="mb-4">
          <label>名前: </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="border px-2 py-1"
          />
          <label className="ml-2">住所: </label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="border px-2 py-1"
          />
          <label className="ml-2">電話番号: </label>
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="border px-2 py-1"
          />
          <label className="ml-2">職業: </label>
          <input
            type="text"
            value={occupation}
            onChange={e => setOccupation(e.target.value)}
            className="border px-2 py-1"
          />
          <label className="ml-2">国籍: </label>
          <input
            type="text"
            value={nationality}
            onChange={e => setNationality(e.target.value)}
            className="border px-2 py-1"
          />
          <label className="ml-2">チェックイン日: </label>
          <input
            type="date"
            value={checkInDate}
            onChange={e => setCheckInDate(e.target.value)}
            className="border px-2 py-1"
          />
          <label className="ml-2">チェックアウト日: </label>
          <input
            type="date"
            value={checkOutDate}
            onChange={e => setCheckOutDate(e.target.value)}
            className="border px-2 py-1"
          />
          <label className="ml-2">プロモーション同意: </label>
          <input
            type="checkbox"
            checked={promoConsent}
            onChange={e => setPromoConsent(e.target.checked)}
            className="ml-1"
          />
          
          <button
            onClick={handleNext}
            disabled={!isInfoComplete}
            className="ml-2 px-4 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            パスポート写真アップロードへ進む
          </button>
        </div>
      )}
      
      {currentStep === 'upload' && (
        <div className="mb-4">
          <h3>パスポート写真をアップロードしてください</h3>
          <PassportUpload 
            onUploaded={setPassportImageUrl} 
            roomId={roomId || ""} 
            guestName={name}     // ← 追加
            client={client}      // ← 追加
          />
          {passportImageUrl && (
            <div className="mt-2">
              <img src={passportImageUrl} alt="パスポート写真" className="max-w-xs" />
            </div>
          )}
          
          <div className="mt-4">
            <button onClick={handleBack} className="px-4 py-1 bg-gray-500 text-white rounded mr-2">
              戻る
            </button>
            <button
              onClick={handleRegister}
              disabled={!passportImageUrl}
              className="px-4 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              登録
            </button>
          </div>
        </div>
      )}
      
      {message && <div className="mb-4 text-green-600">{message}</div>}
      <ChatWidget roomId={roomId || ""} />
    </div>
  )
}