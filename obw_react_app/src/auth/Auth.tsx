import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { generateClient } from 'aws-amplify/api'
import { clearCognitoIdentityCache } from '@/utils/clearCognitoCache'
import { dbg } from '@/utils/debugLogger'

export default function Auth() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const client = generateClient({ authMode: 'iam' })
  const [message, setMessage] = useState('Verifying...')

  useEffect(() => {
    async function run() {
      // Purge any Cognito User Pool tokens from localStorage to avoid interfering with guest IAM flow
      // This removes keys like:
      //   CognitoIdentityServiceProvider.<CLIENT_ID>.LastAuthUser
      //   CognitoIdentityServiceProvider.<CLIENT_ID>.<username>.{accessToken,idToken,refreshToken,clockDrift}
      try {
        const clientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID as string | undefined
        if (clientId) {
          const baseKey = `CognitoIdentityServiceProvider.${clientId}`
          const prefix = `${baseKey}.`
          const toRemove: string[] = []
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (!k) continue
            if (k === `${baseKey}.LastAuthUser` || k.startsWith(prefix)) {
              toRemove.push(k)
            }
          }
          toRemove.forEach(k => localStorage.removeItem(k))
        }
        // Hosted UI flags (defensive)
        localStorage.removeItem('amplify-signin-with-hostedUI')
        localStorage.removeItem('amplify-redirected-from-hosted-ui')
      } catch {}

      const url = new URL(window.location.href)
      const guestId = url.searchParams.get('guestId')
      const token = url.searchParams.get('token')
      const source = url.searchParams.get('source')

      if (!roomId || !guestId || !token) {
        setMessage('Missing params. Redirecting...')
        navigate(`/${roomId || ''}`, { replace: true }) // ❌ パラメータ不足時 - SMS渡さない
        return
      }

      const query = /* GraphQL */ `
        mutation VerifyAccessToken($roomNumber: String!, $guestId: String!, $token: String!) {
          verifyAccessToken(roomNumber: $roomNumber, guestId: $guestId, token: $token) {
            success
            guest { guestId bookingId }
          }
        }
      `
      try {
        type VerifyAccessTokenPayload = { verifyAccessToken: { success: boolean, guest?: { guestId?: string, bookingId?: string } } }
        const res = await client.graphql<VerifyAccessTokenPayload>({
          query,
          variables: { roomNumber: roomId, guestId, token },
        })
        if (import.meta.env.DEV) {
          dbg('VerifyAccessToken result:', res)
          if ('errors' in res && res.errors?.length) console.error('GraphQL errors:', res.errors)
        }
        if ('data' in res && res.data?.verifyAccessToken?.success) {
          const g = res.data.verifyAccessToken.guest
          localStorage.setItem('guestId', g?.guestId || guestId)
          localStorage.setItem('token', token)
          if (g?.bookingId) localStorage.setItem('bookingId', g.bookingId)
          
          setMessage('Verified. Redirecting...')
          navigate(`/${roomId}`, { 
            replace: true,
            state: { 
              smsAccess: source === 'sms',
              originalUrl: `${window.location.origin}/room/${roomId}?guestId=${guestId}&token=${token}`
            }
          })
        } else {
          const firstErr = ('errors' in res && res.errors?.[0]?.message) ? `: ${res.errors[0].message}` : ''
          setMessage(`Verification failed${firstErr}`)
          localStorage.removeItem('guestId')
          localStorage.removeItem('token')
          localStorage.removeItem('bookingId')
          localStorage.removeItem('responseId')
          clearCognitoIdentityCache()
          // ❌ 認証失敗時 - SMS渡さない（どうせエラー画面）
          setTimeout(() => navigate(`/${roomId}`, { replace: true }), 1000)
        }
      } catch (e: any) {
        if (import.meta.env.DEV) console.error('VerifyAccessToken exception:', e)
        setMessage(`Verification error: ${e?.message || 'unknown'}`)
        localStorage.removeItem('guestId')
        localStorage.removeItem('token')
        localStorage.removeItem('bookingId')
        localStorage.removeItem('responseId')
        clearCognitoIdentityCache()
        // ❌ エラー時 - SMS渡さない（どうせエラー画面）
        setTimeout(() => navigate(`/${roomId}`, { replace: true }), 1200)
      }
    }
    run()
  }, [roomId, navigate, client])

  return <p>{message}</p>
}