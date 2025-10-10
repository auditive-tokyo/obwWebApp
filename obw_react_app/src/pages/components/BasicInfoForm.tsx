import CountrySelect from './CountrySelect'
import StructuredAddressInput from '@/pages/components/StructuredAddressInput'
import { BasicCheckInOutDate } from '../roompage/components/BasicCheckInOutDate'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { getMessage } from '@/i18n/messages'
import { parseAddressFields } from '../roompage/utils/formValidation'
import type { InputHTMLAttributes } from 'react'

type BasicInfoFormProps = {
  name: string
  setName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  address: string
  setAddress: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  occupation: string
  setOccupation: (v: string) => void
  nationality: string
  setNationality: (v: string) => void
  checkInDate: Date | null
  setCheckInDate: (v: Date | null) => void
  checkOutDate: Date | null
  setCheckOutDate: (v: Date | null) => void
  promoConsent: boolean
  setPromoConsent: (v: boolean) => void
  isInfoComplete: boolean
  onNext: () => void
  isRepresentativeFamily?: boolean
  hasRoomCheckDates?: boolean
  isAdmin?: boolean  // Admin編集時は必須項目チェックをスキップし、必須マークを非表示にする
}

function CustomPhoneInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-2 py-2 border-none focus:ring-0 focus:outline-none text-base"
      style={{ fontSize: 'inherit', height: 'auto' }}
    />
  )
}

export default function BasicInfoForm(props: BasicInfoFormProps) {
  const {
    name, setName,
    email, setEmail,
    address, setAddress,
    phone, setPhone,
    occupation, setOccupation,
    nationality, setNationality,
    checkInDate, setCheckInDate,
    checkOutDate, setCheckOutDate,
    promoConsent, setPromoConsent,
    isInfoComplete, onNext,
    isRepresentativeFamily = false,
    hasRoomCheckDates = false,
    isAdmin = false,
  } = props

  const phoneError =
    phone && !isValidPhoneNumber(phone)
      ? getMessage("phoneValidation")
      : ""
  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? getMessage("emailValidation")
    : ""

  // 不足している項目のリスト
  const missingFields: string[] = []
  
  if (isRepresentativeFamily) {
    // 代表者の家族の場合：名前のみ必須
    if (!name.trim()) {
      missingFields.push(getMessage("name") as string)
    }
  } else {
    // 家族以外：各項目をチェック
    if (!name.trim()) {
      missingFields.push(getMessage("name") as string)
    }
    if (!email.trim()) {
      missingFields.push(getMessage("email") as string)
    }
    
    // 住所の個別フィールドチェック
    const parsedAddress = parseAddressFields(address)
    if (parsedAddress) {
      if (!parsedAddress.addressLine1.trim()) {
        missingFields.push(getMessage("addressLine1") as string)
      }
      if (!parsedAddress.city.trim()) {
        missingFields.push(getMessage("city") as string)
      }
      if (!parsedAddress.state.trim()) {
        missingFields.push(getMessage("state") as string)
      }
      if (!parsedAddress.country.trim()) {
        missingFields.push(getMessage("country") as string)
      }
      if (!parsedAddress.zipcode.trim()) {
        missingFields.push(getMessage("zipcode") as string)
      }
    } else {
      // address が空またはパース失敗の場合
      missingFields.push(getMessage("addressLine1") as string)
      missingFields.push(getMessage("city") as string)
      missingFields.push(getMessage("state") as string)
      missingFields.push(getMessage("country") as string)
      missingFields.push(getMessage("zipcode") as string)
    }
    
    if (!phone.trim()) {
      missingFields.push(getMessage("phone") as string)
    }
    if (!occupation.trim()) {
      missingFields.push(getMessage("occupation") as string)
    }
    if (!nationality.trim()) {
      missingFields.push(getMessage("nationality") as string)
    }
    // チェックイン・アウト日（部屋日付未設定のときのみチェック）
    if (!hasRoomCheckDates) {
      if (!checkInDate) {
        missingFields.push(getMessage("checkInDate") as string)
      }
      if (!checkOutDate) {
        missingFields.push(getMessage("checkOutDate") as string)
      }
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">
        {getMessage("enterBasicInfo")}
      </h2>

      {/* 家族の場合は案内メッセージを表示 */}
      {isRepresentativeFamily && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            {getMessage("familyRegistrationMessage")}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* 名前 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getMessage("name")}{!isAdmin && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder={getMessage("namePlaceholder") as string}
          />
        </div>

        {/* 代表者の家族でない場合のみ、以下の項目を表示 */}
        {!isRepresentativeFamily && (
          <>
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getMessage("email")}{!isAdmin && <span className="text-red-500">*</span>}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="sample@example.com"
                required={!isAdmin}
              />
              {emailError && (
                <p className="mt-2 text-sm text-red-600">{emailError}</p>
              )}
            </div>

            {/* プロモーション同意（isAdminがfalseの場合のみ表示） */}
            {!isAdmin && (
              <div
                className={
                  `rounded-md border border-gray-200 px-3 py-2 ` +
                  (promoConsent ? 'bg-green-50' : 'bg-gray-50')
                }
              >
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={promoConsent}
                    onChange={e => setPromoConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    aria-describedby="promo-consent-help"
                  />
                  <div className="text-xs text-gray-700">
                    <div className="font-medium flex items-center gap-1">
                      <span role="img" aria-label="mail">📩</span>
                      {getMessage("emailConsent")}
                    </div>
                    <p id="promo-consent-help" className="mt-1 text-[10px] text-gray-500 leading-snug">
                      {(getMessage("promoConsent") as string).split('\n').map((line, i) => (
                        <span key={i}>
                          {line}
                          <br />
                        </span>
                      ))}
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* 住所 */}
            <div>
              <StructuredAddressInput
                value={address}
                onChange={setAddress}
                isAdmin={isAdmin}
              />
            </div>

            {/* 電話番号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getMessage("phone")}{!isAdmin && <span className="text-red-500">*</span>}
              </label>
              <PhoneInput
                international
                defaultCountry="JP"
                value={phone}
                onChange={value => setPhone(value || "")}
                className="w-full px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                inputComponent={CustomPhoneInput}
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
                {getMessage("occupation")}{!isAdmin && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={occupation}
                onChange={e => setOccupation(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder={getMessage("occupationPlaceholder") as string}
              />
            </div>

            {/* 国籍 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getMessage("nationality")}{!isAdmin && <span className="text-red-500">*</span>}
              </label>
              <CountrySelect
                value={nationality}
                onChange={setNationality}
                placeholder={getMessage("nationalityPlaceholder") as string}
              />
            </div>

            {/* チェックイン・アウト日（非家族 かつ 部屋日付未設定のときのみ表示） */}
            {!hasRoomCheckDates && (
              <BasicCheckInOutDate
                checkInDate={checkInDate}
                setCheckInDate={setCheckInDate}
                checkOutDate={checkOutDate}
                setCheckOutDate={setCheckOutDate}
              />
            )}
          </>
        )}

        {/* 次へボタン */}
        <div className="pt-4">
          <button
            onClick={onNext}
            disabled={!isAdmin && !isInfoComplete}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {getMessage("proceedToPassportImageUpload")}
          </button>

          {/* 不足項目リスト（Adminモード時は非表示） */}
          {!isAdmin && !isInfoComplete && missingFields.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-700 mb-2">
                {getMessage("missingFieldsPrompt")}
              </p>
              <ul className="list-disc list-inside space-y-1">
                {missingFields.map((field, index) => (
                  <li key={index} className="text-sm text-red-600">
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}