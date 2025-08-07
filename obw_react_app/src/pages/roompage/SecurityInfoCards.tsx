/**
 * セキュリティ・法的情報に関するカード表示コンポーネント
 * - パスポート情報取得の法的根拠説明
 * - セキュリティ保護に関する説明（AWS KMS、SSL等）
 * - プロフェッショナルで信頼感のあるデザイン
 */
export function SecurityInfoCards() {
  return (
    <>
      {/* セキュリティ・法的情報カード */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              パスポート情報について
            </h3>
            <div className="text-sm text-blue-800 space-y-2">
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
          </div>
        </div>
      </div>

      {/* セキュリティ保護カード */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              セキュリティについて
            </h3>
            <div className="text-sm text-green-800 space-y-1">
              <p className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                </svg>
                <span>お客様の個人情報はAWS KMS（暗号化サービス）により高度に保護されています</span>
              </p>
              <p className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                </svg>
                <span>通信は全てSSL暗号化により安全に送信されます</span>
              </p>
              <p className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                </svg>
                <span>データの保管・管理は国際的なセキュリティ基準に準拠しています</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}