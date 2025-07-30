import { useParams } from 'react-router-dom'
import { useState, useMemo } from 'react'
import ChatWidget from '../components/ChatWidget'
import { generateClient } from 'aws-amplify/api'

function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [name, setName] = useState("")
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
        address: "dummy",
        phone: "dummy",
        occupation: "",
        nationality: "dummy",
        passportImageUrl: "",
        checkInDate: "2025-01-01",
        checkOutDate: "2025-01-02",
        promoConsent: false
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