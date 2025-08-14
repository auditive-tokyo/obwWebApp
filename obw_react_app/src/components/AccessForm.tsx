import { useState } from 'react'
import { generateClient } from 'aws-amplify/api'

type Props = { roomNumber: string }

export default function AccessForm({ roomNumber }: Props) {
  const client = generateClient()
  const [guestName, setGuestName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!guestName || (!email && !phone)) {
      setError('お名前とEmailまたは電話番号のどちらかは必須です')
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
        variables: { input: { roomNumber, guestName, email: email || null, phone: phone || null } },
        authMode: 'iam',
      })
      if (import.meta.env.DEV) {
        console.log('RequestAccess result:', res)
        // union 型のため 'errors' in res でチェック
        if ('errors' in res && res.errors?.length) {
          console.error('GraphQL errors:', res.errors)
        }
      }
      if ('data' in res && res.data?.requestAccess?.success) {
        setMessage('アクセスリンクを送信しました。メール/SMSをご確認ください。')
      } else {
        const firstErr = ('errors' in res && res.errors?.[0]?.message) ? `: ${res.errors[0].message}` : ''
        setError(`送信に失敗しました${firstErr}`)
      }
    } catch (e: any) {
      if (import.meta.env.DEV) console.error('RequestAccess exception:', e)
      const msg =
        Array.isArray(e?.errors) && e.errors[0]?.message
          ? e.errors[0].message
          : e?.message || JSON.stringify(e)
      setError(`送信に失敗しました: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  if (message) return <p>{message}</p>

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 420 }}>
      <h3>アクセス申請</h3>
      <div>
        <label>お名前</label>
        <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="山田 太郎" />
      </div>
      <div>
        <label>Email（どちらか必須）</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div>
        <label>電話番号（どちらか必須）</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+81..." />
      </div>
      <button disabled={loading}>{loading ? '送信中…' : 'リンクを送信'}</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  )
}