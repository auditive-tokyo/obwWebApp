import { useState } from "react"

/**
 * セキュリティ・法的情報に関するカード表示コンポーネント
 * - パスポート情報取得の法的根拠説明
 * - セキュリティ保護に関する説明（AWS KMS、SSL等）
 * - プロフェッショナルで信頼感のあるデザイン
 */
export function SecurityInfoCards() {
  const [expanded, setExpanded] = useState<null | "law" | "security">(null)

  // カード内容
  const lawCard = (
    <div
      className="bg-blue-50 border border-blue-200 rounded-lg p-4 m-2 cursor-pointer transition-all duration-200 basis-1/2 text-sm hover:shadow-lg"
      onClick={() => setExpanded("law")}
    >
      <div className="flex items-start space-x-2">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
        </svg>
        <div>
          <h3 className="font-semibold text-blue-900 mb-1 text-base">パスポート情報について</h3>
          <div className="text-blue-800">
            旅館業法により、宿泊者の身元確認・記録保持が義務付けられています。外国人宿泊者はパスポート詳細の複写・保管が必要です。
          </div>
        </div>
      </div>
    </div>
  )

  const securityCard = (
    <div
      className="bg-green-50 border border-green-200 rounded-lg p-4 m-2 cursor-pointer transition-all duration-200 basis-1/2 text-sm hover:shadow-lg"
      onClick={() => setExpanded("security")}
    >
      <div className="flex items-start space-x-2">
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
        </svg>
        <div>
          <h3 className="font-semibold text-green-900 mb-1 text-base">セキュリティについて</h3>
          <div className="text-green-800">
            個人情報はAWS KMSで保護、通信はSSL暗号化、国際基準に準拠しています。
          </div>
        </div>
      </div>
    </div>
  )

  // 拡大表示
  const expandedCard = expanded && (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      onClick={() => setExpanded(null)}
    >
      <div
        className={`${
          expanded === "law"
            ? "bg-blue-50 border-blue-200"
            : "bg-green-50 border-green-200"
        } border rounded-lg p-6 w-full max-w-xl mx-auto shadow-2xl text-base cursor-pointer`}
        onClick={e => e.stopPropagation()}
      >
        {expanded === "law" ? (
          <>
            <div className="flex items-start space-x-3 mb-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-blue-900">パスポート情報について</h3>
            </div>
            <div className="text-blue-800 space-y-2">
              <p>
                旅館業法により、宿泊事業者は宿泊者の身元確認および記録保持が法的に義務付けられています。
                外国人宿泊者の場合、パスポート詳細の複写と一定期間の保管が必要となります。
              </p>
              <p>
                この情報は必要に応じて政府機関から要請される場合があるため、
                法令遵守のためファイルに保管させていただきます。
                ご理解とご協力をお願いいたします。
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start space-x-3 mb-2">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-green-900">セキュリティについて</h3>
            </div>
            <div className="text-green-800 space-y-1">
              <p>
                お客様の個人情報はAWS KMS（暗号化サービス）により高度に保護されています。
              </p>
              <p>
                通信は全てSSL暗号化により安全に送信されます。
              </p>
              <p>
                データの保管・管理は国際的なセキュリティ基準に準拠しています。
              </p>
            </div>
          </>
        )}
        <div className="mt-6 text-right">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setExpanded(null)}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-row">
      {lawCard}
      {securityCard}
      {expandedCard}
    </div>
  )
}