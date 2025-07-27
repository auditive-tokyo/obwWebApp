import { useParams } from 'react-router-dom'

function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  return (
    <div className="container mx-auto p-4">
      <p>{roomId}号室のページです。</p>
      {/* 部屋ごとの情報やコンテンツ */}
    </div>
  )
}

export default RoomPage