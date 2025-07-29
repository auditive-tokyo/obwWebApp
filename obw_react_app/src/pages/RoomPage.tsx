import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ChatWidget from '../components/ChatWidget'
import { generateClient } from 'aws-amplify/api'
import { fetchAuthSession } from 'aws-amplify/auth'

function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")

  const client = generateClient()

  useEffect(() => {
    const getSession = async () => {
      try {
        const session = await fetchAuthSession()
        console.log("現在のセッション:", session)
      } catch (error) {
        console.error("セッション取得エラー:", error)
      }
    }
    getSession()
  }, [])

  const handleRegister = async () => {
    const query = `
      mutation CreateGuest($input: CreateGuestInput!) {
        createGuest(input: $input) {
          id
          name
        }
      }
    `
    const variables = {
      input: {
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
    console.log("送信クエリ:", query)
    console.log("送信変数:", variables)
    try {
      const res = await client.graphql({
        query,
        variables,
        authMode: 'iam'
      })
      console.log("GraphQLレスポンス:", res)
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