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

  const client = useMemo(() => generateClient(), [])

  const handleRegister = async () => {
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
        passportImageUrl,
        checkInDate,
        checkOutDate,
        promoConsent
      }
    }
    console.debug("送信クエリ:", query)
    console.debug("送信変数:", variables)
    try {
      const res = await client.graphql({
        query,
        variables,
        authMode: 'iam'
      })
      console.debug("GraphQLレスポンス:", res)
      setMessage("登録しました")
    } catch (e) {
      console.error("GraphQLエラー:", e)
      setMessage("登録に失敗しました")
    }
  }

  return (
    <div className="container mx-auto p-4">
      <p>{roomId}号室のページです。</p>
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
        <label className="ml-2">パスポート写真: </label>
        <PassportUpload onUploaded={setPassportImageUrl} roomId={roomId || ""} />
        {passportImageUrl && (
          <div className="mt-2">
            <img src={passportImageUrl} alt="パスポート写真" className="max-w-xs" />
          </div>
        )}
        <button
          onClick={handleRegister}
          className="ml-2 px-4 py-1 bg-blue-500 text-white rounded"
        >
          登録
        </button>
      </div>
      {message && <div className="mb-4 text-green-600">{message}</div>}
      <ChatWidget roomId={roomId || ""} />
    </div>
  )
}

export default RoomPage