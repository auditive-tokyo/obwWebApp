import { useEffect, useState } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'

function CheckinPage() {
  const [searchParams] = useSearchParams()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  
  // URLパラメータを取得
  const room = searchParams.get('room')

  useEffect(() => {
    // 必須パラメータのチェック
    const isRoomValid = room !== null && room !== ''
    setIsAuthorized(isRoomValid)
  }, [room])

  // 認証状態確認中は読み込み表示
  if (isAuthorized === null) {
    return <div>Loading...</div>
  }
  
  // 認証失敗時はエラーページへリダイレクト
  if (isAuthorized === false) {
    return <Navigate to="/error" />
  }
  
  // 認証成功時のメインコンテンツ
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Osaka Bay Wheel Check-in</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl mb-2">予約情報</h2>
        <p><strong>部屋番号:</strong> {room}</p>
        {/* ここに追加のチェックイン機能を実装 */}
      </div>
    </div>
  )
}

export default CheckinPage