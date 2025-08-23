import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { generateClient } from 'aws-amplify/api'

export default function Auth() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const client = generateClient()
  const [message, setMessage] = useState('Verifying...')

  useEffect(() => {
    async function run() {
      const url = new URL(window.location.href)
      const guestId = url.searchParams.get('guestId')
      const token = url.searchParams.get('token')

      if (!roomId || !guestId || !token) {
        setMessage('Missing params. Redirecting...')
        navigate(`/${roomId || ''}`, { replace: true })
        return
      }

      const query = /* GraphQL */ `
        mutation VerifyAccessToken($roomNumber: String!, $guestId: String!, $token: String!) {
          verifyAccessToken(roomNumber: $roomNumber, guestId: $guestId, token: $token) {
            success
          }
        }
      `
      try {
        type VerifyAccessTokenPayload = { verifyAccessToken: { success: boolean } }
        const res = await client.graphql<VerifyAccessTokenPayload>({
          query,
          variables: { roomNumber: roomId, guestId, token },
          authMode: 'iam',
        })
        if (import.meta.env.DEV) {
          console.log('VerifyAccessToken result:', res)
          if ('errors' in res && res.errors?.length) console.error('GraphQL errors:', res.errors)
        }
        if ('data' in res && res.data?.verifyAccessToken?.success) {
          localStorage.setItem('guestId', guestId)
          localStorage.setItem('token', token)
          setMessage('Verified. Redirecting...')
          navigate(`/${roomId}`, { replace: true })
        } else {
          const firstErr = ('errors' in res && res.errors?.[0]?.message) ? `: ${res.errors[0].message}` : ''
          setMessage(`Verification failed${firstErr}`)
          setTimeout(() => navigate(`/${roomId}`, { replace: true }), 1000)
        }
      } catch (e: any) {
        if (import.meta.env.DEV) console.error('VerifyAccessToken exception:', e)
        setMessage(`Verification error: ${e?.message || 'unknown'}`)
        setTimeout(() => navigate(`/${roomId}`, { replace: true }), 1200)
      }
    }
    run()
  }, [roomId, navigate, client])

  return <p>{message}</p>
}