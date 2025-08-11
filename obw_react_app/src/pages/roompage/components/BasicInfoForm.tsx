import { useMemo, useState } from 'react'
import CountrySelect from './CountrySelect'
import StructuredAddressInput from './StructuredAddressInput'
import { BasicCheckInOutDate } from './BasicCheckInOutDate'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

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
}

function CustomPhoneInput(props: any) {
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
  } = props

  const [addrOpen, setAddrOpen] = useState(false)

  const addrSummary = useMemo(() => {
    if (!address) return ''
    try {
      const a = JSON.parse(address)
      return [a.addressLine2, a.addressLine1, a.city, a.state, a.country, a.zipcode]
        .filter(Boolean)
        .join(', ')
    } catch {
      return address
    }
  }, [address])

  const phoneError =
    phone && !isValidPhoneNumber(phone)
      ? "正しい電話番号を入力してください"
      : ""
  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? "正しいメールアドレスを入力してください"
    : ""

  return (
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

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="sample@example.com"
            required
          />
          {emailError && (
            <p className="mt-2 text-sm text-red-600">{emailError}</p>
          )}
        </div>

        {/* プロモーション同意 */}
        <div
          className={
            `rounded-md border border-gray-200 px-3 py-2 ` +
            (promoConsent ? 'bg-pink-50' : 'bg-gray-50')
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
                最新情報をメールで受け取る
              </div>
              <p id="promo-consent-help" className="mt-1 text-[10px] text-gray-500 leading-snug">
                プロモーションや特別割引、近隣イベント情報などをお送りします。<br />
                受取りをご希望されない場合はチェックは外したままにして下さい。
              </p>
            </div>
          </label>
        </div>

        {/* 住所 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            住所 <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600 truncate">{addrSummary || '未入力'}</div>
            <button
              type="button"
              className="text-sm text-blue-600"
              onClick={() => setAddrOpen(v => !v)}
            >
              {addrOpen ? '閉じる' : '入力・編集'}
            </button>
          </div>
          {addrOpen && (
            <StructuredAddressInput
              value={address}
              onChange={setAddress}
              onValidityChange={(valid) => { if (!valid) { setAddrOpen(true) } }}
            />
          )}
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
            className="w-full px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            inputComponent={CustomPhoneInput}
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
          <CountrySelect
            value={nationality}
            onChange={setNationality}
            placeholder="国籍を選択してください"
          />
        </div>

        {/* チェックイン・アウト日 */}
        <BasicCheckInOutDate
          checkInDate={checkInDate}
          setCheckInDate={setCheckInDate}
          checkOutDate={checkOutDate}
          setCheckOutDate={setCheckOutDate}
        />

        {/* 次へボタン */}
        <div className="pt-4">
          <button
            onClick={onNext}
            disabled={!isInfoComplete}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
          >
            パスポート写真アップロードへ進む
          </button>
        </div>
      </div>
    </div>
  )
}