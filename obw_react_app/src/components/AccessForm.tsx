import { useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { getMessage } from '@/i18n/messages'

type Props = { roomNumber: string }

function CustomPhoneInput(props: any) {
  return (
    <input
      {...props}
      className="w-full border-none focus:ring-0 focus:outline-none text-base leading-normal px-3 py-2"
      style={{ fontSize: 'inherit', height: 'auto', lineHeight: '1.35' }}
    />
  )
}

export default function AccessForm({ roomNumber }: Props) {
  const client = generateClient()
  const [guestName, setGuestName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [delivery, setDelivery] = useState<'email' | 'sms'>('email')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // バリデーション
  const phoneError =
    phone && !isValidPhoneNumber(phone)
      ? getMessage("phoneValidation")
      : ""
  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? getMessage("emailValidation")
    : ""

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!guestName || !email || !phone) {
      setError('お名前・Email・電話番号はすべて必須です')
      return
    }
    if (emailError) {
      setError(Array.isArray(emailError) ? emailError.join(', ') : emailError)
      return
    }
    if (phoneError) {
      setError(Array.isArray(phoneError) ? phoneError.join(', ') : phoneError)
      return
    }
    setLoading(true)
    try {
      const mutation = /* GraphQL */ `
        mutation RequestAccess($input: RequestAccessInput!) {
          requestAccess(input: $input) {
            success
            guestId
          }
        }
      `
      type Payload = { requestAccess: { success: boolean; guestId: string } }
      const res = await client.graphql<Payload>({
        query: mutation,
        variables: {
          input: {
            roomNumber,
            guestName,
            email,
            phone,
            contactChannel: delivery,
          },
        },
        authMode: 'iam',
      })
      if ('data' in res && res.data?.requestAccess?.success) {
        setMessage(
          delivery === 'email'
            ? 'メールにアクセスリンクを送信しました。ご確認ください。'
            : 'SMSにアクセスリンクを送信しました。ご確認ください。'
        )
      } else {
        const firstErr = ('errors' in res && res.errors?.[0]?.message) ? `: ${res.errors[0].message}` : ''
        setError(`送信に失敗しました${firstErr}`)
      }
    } catch (e: any) {
      const msg =
        Array.isArray(e?.errors) && e.errors[0]?.message
          ? e.errors[0].message
          : e?.message || JSON.stringify(e)
      setError(`送信に失敗しました: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  if (message) return <p className="text-green-700 text-center py-4">{message}</p>

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto bg-white shadow rounded-lg p-6 space-y-5">
      <h3 className="text-lg font-bold mb-4 text-center">アクセス申請</h3>
      <div>
        <label className="block text-sm font-medium mb-1">お名前 <span className="text-red-500">*</span></label>
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="山田 太郎"
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
          required
        />
        {emailError && (
          <p className="mt-2 text-sm text-red-600">{emailError}</p>
        )}
      </div>
      {/* 電話番号 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          電話番号<span className="text-red-500">*</span>
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
      <div>
        <label className="block text-sm font-medium mb-1">リンクの受け取り方法</label>
        <div className="flex gap-6 mt-1">
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio"
              checked={delivery === 'email'}
              onChange={() => setDelivery('email')}
            />
            <span className="ml-2">メールで受け取る</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio"
              checked={delivery === 'sms'}
              onChange={() => setDelivery('sms')}
            />
            <span className="ml-2">SMSで受け取る</span>
          </label>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
      >
        {loading ? '送信中…' : 'リンクを送信'}
      </button>
      {error && <p className="text-red-600 text-center">{error}</p>}
    </form>
  )
}