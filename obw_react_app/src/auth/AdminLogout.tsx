import { useEffect } from 'react'
import { clearCognitoIdentityCache } from '@/utils/clearCognitoCache'

export default function AdminLogout() {
  useEffect(() => {
    try {
      // アプリ側セッションをクリア
      localStorage.removeItem('guestId')
      localStorage.removeItem('token')
      localStorage.removeItem('bookingId')
      clearCognitoIdentityCache?.()
    } catch {}

    const domain = import.meta.env.VITE_COGNITO_OAUTH_DOMAIN
    const clientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID
    const redirect = import.meta.env.VITE_COGNITO_REDIRECT_SIGNOUT

    if (domain && clientId && redirect) {
      const url = `https://${domain}/logout?client_id=${encodeURIComponent(clientId)}&logout_uri=${encodeURIComponent(redirect)}`
      window.location.replace(url)
    } else {
      // 必要なenvが無い場合はトップへ退避
      window.location.replace('/')
    }
  }, [])

  return <p>Signed out…</p>
}