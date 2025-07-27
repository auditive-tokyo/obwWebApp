import { useParams } from 'react-router-dom'

const allowedRooms = ['201', '304']

function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  if (!roomId || !allowedRooms.includes(roomId)) {
    return <div>この部屋は存在しません。</div>
  }
  return (
    <div className="container mx-auto p-4">
      <p>{roomId}号室のページです。</p>
      {/* 部屋ごとの情報やコンテンツ */}
    </div>
  )
}

export default RoomPage