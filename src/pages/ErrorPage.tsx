import { Link } from 'react-router-dom'

function ErrorPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-red-600 mb-4">アクセスエラー</h1>
        <p className="mb-6">
          このページにアクセスするには有効な予約情報が必要です。
          <br />
          メールに記載されたリンクからアクセスしてください。
        </p>
        <Link 
          to="/" 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  )
}

export default ErrorPage