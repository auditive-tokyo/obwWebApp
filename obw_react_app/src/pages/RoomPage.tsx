import { useParams } from 'react-router-dom'
import { useState, useMemo } from 'react'
import ChatWidget from '../components/ChatWidget'
import { generateClient } from 'aws-amplify/api'
import { PassportUpload } from './roompage/PassportUpload'

function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [occupation, setOccupation] = useState("")
  const [nationality, setNationality] = useState("")
  const [checkInDate, setCheckInDate] = useState("")
  const [checkOutDate, setCheckOutDate] = useState("")
  const [promoConsent, setPromoConsent] = useState(false)
  const [passportImageUrl, setPassportImageUrl] = useState("")
  const [message, setMessage] = useState("")
  const [currentStep, setCurrentStep] = useState<'info' | 'upload'>('info')

  const client = useMemo(() => generateClient(), [])

  const handleRegister = async () => {
    setMessage("パスポート画像を更新中...")
    
    const query = `
      mutation UpdateGuest($input: UpdateGuestInput!) {
        updateGuest(input: $input) {
          roomNumber
          name
          passportImageUrl
        }
      }
    `
    const variables = {
      input: {
        roomNumber: roomId || "", // IDとして使用
        passportImageUrl
      }
    }
    
    try {
      const res = await client.graphql({
        query,
        variables,
        authMode: 'iam'
      })
      console.debug("パスポート画像更新完了:", res)
      setMessage("登録が完了しました！")
    } catch (e) {
      console.error("パスポート画像更新エラー:", e)
      setMessage("パスポート画像の更新に失敗しました")
    }
  }

  const handleNext = async () => {
    if (isInfoComplete) {
      setMessage("基本情報を登録中...")
      
      const query = `
        mutation CreateGuest($input: CreateGuestInput!) {
          createGuest(input: $input) {
            id
            name
            roomNumber
          }
        }
      `
      const variables = {
        input: {
          roomNumber: roomId || "",
          name,
          address,
          phone,
          occupation,
          nationality,
          passportImageUrl: "", // まだ空
          checkInDate,
          checkOutDate,
          promoConsent
        }
      }
      
      try {
        const res = await client.graphql({
          query,
          variables,
          authMode: 'iam'
        })
        console.debug("基本情報登録完了:", res)
        setMessage("基本情報を登録しました。パスポート写真をアップロードしてください。")
        setCurrentStep('upload')
      } catch (e) {
        console.error("基本情報登録エラー:", e)
        setMessage("基本情報の登録に失敗しました")
      }
    }
  }

  // バリデーション
  const isInfoComplete = name && address && phone && occupation && nationality && checkInDate && checkOutDate

  const handleBack = () => {
    setCurrentStep('info')
  }

  return (
    <div className="container mx-auto p-4">
      <p>{roomId}号室のページです。</p>
      
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
          <PassportUpload onUploaded={setPassportImageUrl} roomId={roomId || ""} />
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

export default RoomPage