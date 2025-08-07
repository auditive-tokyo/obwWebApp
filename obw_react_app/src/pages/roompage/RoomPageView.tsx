import { PassportUpload } from './PassportUpload'
import ChatWidget from '../../components/ChatWidget'
import Select from 'react-select'
import countryList from 'react-select-country-list'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import type { RoomPageViewProps } from './types'

export function RoomPageView(props: RoomPageViewProps) {
  const {
    roomId,
    approvalStatus,
    currentStep,
    name,
    setName,
    address,
    setAddress,
    phone,
    setPhone,
    occupation,
    setOccupation,
    nationality,
    setNationality,
    checkInDate,
    setCheckInDate,
    checkOutDate,
    setCheckOutDate,
    promoConsent,
    setPromoConsent,
    passportImageUrl,
    setPassportImageUrl,
    handleNext,
    handleBack,
    handleRegister,
    isInfoComplete,
    message,
    client
  } = props

  const options = countryList().getData()
  // バリデーション
  const phoneError =
    phone && !isValidPhoneNumber(phone)
      ? "正しい電話番号を入力してください"
      : ""

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* ヘッダーカード */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {roomId}号室
          </h1>
          <p className="text-gray-600">
            現在のステータス: <span className="font-medium text-blue-600">{approvalStatus}</span>
          </p>
        </div>

        {/* 基本情報入力フォーム */}
        {currentStep === 'info' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">基本情報を入力してください</h2>
            
            <div className="space-y-4">
              {/* 名前 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="山田太郎"
                />
              </div>

              {/* 住所 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  住所 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="東京都渋谷区..."
                />
              </div>

              {/* 電話番号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  電話番号 <span className="text-red-500">*</span>
                </label>
                <PhoneInput
                  international
                  defaultCountry="JP"
                  value={phone}
                  onChange={value => setPhone(value || "")}
                  className="w-full"
                  placeholder="電話番号を入力"
                  style={{
                    '--PhoneInputCountryFlag-height': '1.2em',
                    '--PhoneInput-color--focus': '#3B82F6'
                  } as React.CSSProperties}
                />
                {phoneError && (
                  <p className="mt-2 text-sm text-red-600">{phoneError}</p>
                )}
              </div>

              {/* 職業 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  職業 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={occupation}
                  onChange={e => setOccupation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="会社員"
                />
              </div>

              {/* 国籍 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  国籍 <span className="text-red-500">*</span>
                </label>
                <Select
                  options={options}
                  value={options.find(opt => opt.label === nationality) || null}
                  onChange={opt => setNationality(opt?.label || "")}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="国籍を選択してください"
                  isClearable
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: '48px',
                      borderColor: '#D1D5DB',
                      '&:hover': { borderColor: '#9CA3AF' },
                      '&:focus-within': {
                        borderColor: '#3B82F6',
                        boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)'
                      }
                    })
                  }}
                />
              </div>

              {/* チェックイン・アウト日 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    チェックイン日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={e => setCheckInDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    チェックアウト日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={checkOutDate}
                    onChange={e => setCheckOutDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* プロモーション同意 */}
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={promoConsent}
                  onChange={e => setPromoConsent(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="text-sm text-gray-700">
                  プロモーション情報の受信に同意します
                </label>
              </div>

              {/* 次へボタン */}
              <div className="pt-4">
                <button
                  onClick={handleNext}
                  disabled={!isInfoComplete}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  パスポート写真アップロードへ進む
                </button>
              </div>
            </div>
          </div>
        )}

        {/* パスポートアップロード画面 */}
        {currentStep === 'upload' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">パスポート写真をアップロード</h2>
            
            <div className="space-y-6">
              <PassportUpload 
                onUploaded={setPassportImageUrl} 
                roomId={roomId || ""} 
                guestName={name}
                client={client}
              />
              
              {passportImageUrl && (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <img 
                    src={passportImageUrl} 
                    alt="パスポート写真" 
                    className="mx-auto max-w-xs rounded-lg shadow-sm"
                  />
                  <p className="mt-2 text-sm text-gray-600">アップロード完了</p>
                </div>
              )}
              
              <div className="flex space-x-4">
                <button 
                  onClick={handleBack} 
                  className="flex-1 py-3 px-4 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200"
                >
                  戻る
                </button>
                <button
                  onClick={handleRegister}
                  disabled={!passportImageUrl}
                  className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  登録完了
                </button>
              </div>
            </div>
          </div>
        )}

        {/* メッセージ表示 */}
        {message && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
            {message}
          </div>
        )}

        {/* チャット */}
        <div className="mt-8">
          <ChatWidget roomId={roomId || ""} />
        </div>
      </div>
    </div>
  )
}