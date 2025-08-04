import { useParams } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import ChatWidget from '../components/ChatWidget'
import { generateClient } from 'aws-amplify/api'
import { PassportUpload } from './roompage/PassportUpload'
import { saveGuestSession, loadGuestSession, type ApprovalStatus } from './roompage/sessionUtils'

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
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('waitingForPassportImage')

  // ページロード時のセッション復旧
  useEffect(() => {
    if (roomId && name) {
      const session = loadGuestSession(roomId, name)
      if (session) {
        setApprovalStatus(session.approvalStatus)
        // ← 他のstateも復元
        setPhone(session.phone)
        
        // ← ステップも復旧
        if (session.approvalStatus !== 'waitingForPassportImage') {
          setCurrentStep('upload')
        }
      }
    }
  }, [roomId, name])

  const client = useMemo(() => generateClient(), [])

  // 署名付きURLからパス部分だけ抽出
  let s3Url = passportImageUrl
  try {
    const url = new URL(passportImageUrl)
    console.debug("Extracted URL:", url)
    s3Url = `${url.origin}${url.pathname}`
  } catch (e) {
    console.error("Invalid URL format:", passportImageUrl, e)
  }

  const handleRegister = async () => {
    setMessage("パスポート画像を更新中...")
    
    const query = `
      mutation UpdateGuest($input: UpdateGuestInput!) {
        updateGuest(input: $input) {
          roomNumber
          guestName
          passportImageUrl
          approvalStatus
        }
      }
    `
    const variables = {
      input: {
        roomNumber: roomId || "",
        guestName: name,
        passportImageUrl: s3Url,
        approvalStatus: 'pending'
      }
    }
    
    console.log("=== DynamoDB Update Debug ===")
    console.log("Variables:", JSON.stringify(variables, null, 2))
    
    try {
      const res = await client.graphql({
        query,
        variables,
        authMode: 'iam'
      })
      
      console.log("=== Update Response ===")
      console.log("Response:", JSON.stringify(res, null, 2))

      // LocalStorage更新
      const session = loadGuestSession(roomId || "", name)
      if (session) {
        session.approvalStatus = 'pending'
        session.lastUpdated = new Date().toISOString()
        saveGuestSession(session)
      }
      
      setApprovalStatus('pending')
      setMessage("登録が完了しました！")
    } catch (e) {
      console.error("=== Update Error ===")
      console.error("Error details:", e)
      setMessage("パスポート画像の更新に失敗しました")
    }
  }

  const handleNext = async () => {
    if (isInfoComplete) {
      setMessage("基本情報を登録中...")
      
      const query = `
        mutation CreateGuest($input: CreateGuestInput!) {
          createGuest(input: $input) {
            roomNumber
            guestName
          }
        }
      `
      const variables = {
        input: {
          roomNumber: roomId || "",
          guestName: name,
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

        // ← saveGuestSessionを追加
        saveGuestSession({
          roomNumber: roomId || "",
          guestName: name,
          phone,
          registrationDate: new Date().toISOString().split('T')[0],
          approvalStatus: 'waitingForPassportImage',
          lastUpdated: new Date().toISOString()
        })
        
        setApprovalStatus('waitingForPassportImage')

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

export default RoomPage