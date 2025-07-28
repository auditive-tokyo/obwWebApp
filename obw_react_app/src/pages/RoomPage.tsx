import { useParams } from 'react-router-dom'
import ChatWidget from '../components/ChatWidget'

function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()  // URLからroomIdを取得

  return (
    <div className="container mx-auto p-4">
      <p>{roomId}号室のページです。</p>
      {/* 部屋ごとの情報やコンテンツ */}
      <ChatWidget roomId={roomId || ""} />
    </div>
  )
}

export default RoomPage