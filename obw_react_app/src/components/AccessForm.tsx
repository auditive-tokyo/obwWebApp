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
      className="w-full border-none focus:ring-0 focus:outline-none text-base leading-normal px-3 py-1 bg-transparent"
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
      setError(getMessage("allFieldsRequired") as string)
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
            ...(localStorage.getItem('lang') ? { lang: localStorage.getItem('lang') } : {})
          },
        },
        authMode: 'iam',
      })
      if ('data' in res && res.data?.requestAccess?.success) {
        setMessage(
          delivery === 'email'
            ? getMessage("emailLinkSent") as string
            : getMessage("smsLinkSent") as string
        )
      } else {
        const firstErr = ('errors' in res && res.errors?.[0]?.message) ? `: ${res.errors[0].message}` : ''
        setError(`${getMessage("sendFailed")}${firstErr}`)
      }
    } catch (e: any) {
      const msg =
        Array.isArray(e?.errors) && e.errors[0]?.message
          ? e.errors[0].message
          : e?.message || JSON.stringify(e)
      setError(`${getMessage("sendFailed")}: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  if (message) return <p className="text-green-700 text-center py-4">{message}</p>

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto bg-white shadow-2xl hover:shadow-3xl transition-shadow duration-300 rounded-2xl p-8 space-y-6 border border-gray-100 backdrop-blur-sm">
      <h3 className="text-lg font-bold mb-4 text-center">{getMessage("accessRequest")}</h3>
      <div>
        <label className="block text-sm font-medium mb-1">{getMessage("nameRequired")} <span className="text-red-500">*</span></label>
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder={getMessage("namePlaceholder") as string}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{getMessage("email")} <span className="text-red-500">*</span></label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
          required
        />
        {emailError && (
          <p className="mt-2 text-sm text-red-600">{emailError}</p>
        )}
      </div>
      {/* 電話番号 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {getMessage("phone")}<span className="text-red-500">*</span>
        </label>
        <div className="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
          <PhoneInput
            international
            defaultCountry="JP"
            value={phone}
            onChange={value => setPhone(value || "")}
            className="w-full px-4 py-2"
            inputComponent={CustomPhoneInput}
            style={{
              '--PhoneInputCountryFlag-height': '1.2em',
              '--PhoneInput-color--focus': '#3B82F6'
            } as React.CSSProperties}
          />
        </div>
        {phoneError && (
          <p className="mt-2 text-sm text-red-600">{phoneError}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{getMessage("linkDeliveryMethod")}</label>
        <div className="flex gap-6 mt-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio text-blue-600 focus:ring-blue-500"
              checked={delivery === 'email'}
              onChange={() => setDelivery('email')}
            />
            <span className="ml-2">{getMessage("receiveByEmail")}</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio text-blue-600 focus:ring-blue-500"
              checked={delivery === 'sms'}
              onChange={() => setDelivery('sms')}
            />
            <span className="ml-2">{getMessage("receiveBySMS")}</span>
          </label>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
       className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:hover:transform-none disabled:hover:shadow-lg"
      >
        {loading ? getMessage("submitting") : getMessage("sendLink")}
      </button>
      {error && <p className="text-red-600 text-center">{error}</p>}
    </form>
  )
}