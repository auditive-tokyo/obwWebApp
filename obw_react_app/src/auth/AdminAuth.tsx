import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
// Amplify Auth (v6 modular). Assumes Amplify is configured elsewhere in the app.
import { getCurrentUser, signInWithRedirect } from 'aws-amplify/auth'
import AdminPage from '../pages/AdminPage'
import { dbg } from '@/utils/debugLogger'

export default function AdminAuth() {
  const location = useLocation()
  const navigate = useNavigate()
  const [message, setMessage] = useState('Checking authentication...')
  const [ready, setReady] = useState(false)

  // Adminルート入場時にゲスト用キーを掃除
  const clearGuestStorage = () => {
    const KEYS = ['bookingId', 'guestId', 'token', 'responseId'] // 必要なら実キー名に合わせて調整
    try {
      for (const k of KEYS) localStorage.removeItem(k)
      // プレフィックスで管理している場合の掃除（任意）
      const prefixes = ['guest:', 'room:', 'obw.guest.']
      const toRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || ''
        if (prefixes.some(p => key.startsWith(p))) toRemove.push(key)
      }
      toRemove.forEach(k => localStorage.removeItem(k))
    } catch {}
  }

  useEffect(() => {
    async function ensureAuthenticated() {
      dbg('path:', location.pathname, 'search:', location.search)

      // /admin配下に来たら先にゲスト情報を掃除
      clearGuestStorage()

      try {
        if (location.pathname.startsWith('/admin/callback')) {
          setMessage('Completing sign-in...')
          const qs = new URLSearchParams(location.search)
          dbg('callback detected. code:', qs.get('code'), 'state:', qs.get('state'))

          // Hosted UI 戻り直後はトークン確立待ち（短時間リトライ）
          const deadline = Date.now() + 8000
          let ok = false, lastErr: any
          while (Date.now() < deadline) {
            try {
              const u = await getCurrentUser()
              dbg('getCurrentUser OK on callback:', u)
              ok = true
              break
            } catch (e) {
              lastErr = e
              await new Promise(r => setTimeout(r, 250))
            }
          }
          if (!ok) {
            console.error('[AdminAuth] getCurrentUser still failing after callback:', lastErr)
            throw lastErr || new Error('No current user after callback')
          }

          // サインイン確立後にもう一度掃除（冪等）
          clearGuestStorage()

          setReady(true)
          setMessage('')
          dbg('navigate -> /admin')
          navigate('/admin', { replace: true })
          return
        }

        dbg('checking current user...')
        const u = await getCurrentUser()
        dbg('signed in as:', u)
        setReady(true)
        setMessage('')
      } catch (e) {
        console.warn('[AdminAuth] not signed in. Redirecting to Hosted UI.', e)
        console.warn('env:', {
          domain: import.meta.env.VITE_COGNITO_OAUTH_DOMAIN,
          clientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
          redirect: import.meta.env.VITE_COGNITO_REDIRECT_SIGNIN,
        })
        await signInWithRedirect()
      }
    }

    ensureAuthenticated()
  }, [location.pathname, location.search, navigate])

  if (!ready) return <p>{message}</p>
  return <AdminPage />
}
