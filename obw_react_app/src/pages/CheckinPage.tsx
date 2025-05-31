import { useEffect, useState } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'

function CheckinPage() {
  const [searchParams] = useSearchParams()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  
  // URLパラメータを取得
  const room = searchParams.get('room')
  const conf = searchParams.get('conf')
  const checkIn = searchParams.get('in')
  const checkOut = searchParams.get('out')
  const outTime = searchParams.get('outtime')
  
  useEffect(() => {
    // 必須パラメータのチェック
    const requiredParams = { room, conf, checkIn, checkOut }
    const hasAllParams = Object.values(requiredParams).every(param => param !== null && param !== '')
    
    // パラメータの検証ロジック (ここを拡張して実際の検証を行う)
    const areParamsValid = hasAllParams
    
    setIsAuthorized(areParamsValid)
  }, [room, conf, checkIn, checkOut])
  
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
        <p><strong>確認番号:</strong> {conf}</p>
        <p><strong>チェックイン日:</strong> {checkIn}</p>
        <p><strong>チェックアウト日:</strong> {checkOut}</p>
        {outTime && <p><strong>チェックアウト時間:</strong> {outTime}</p>}
        
        {/* ここに追加のチェックイン機能を実装 */}
      </div>
    </div>
  )
}

export default CheckinPage