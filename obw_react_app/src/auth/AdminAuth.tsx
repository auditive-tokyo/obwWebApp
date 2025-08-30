import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
// Amplify Auth (v6 modular). Assumes Amplify is configured elsewhere in the app.
import { getCurrentUser, signInWithRedirect } from 'aws-amplify/auth'
import AdminPage from '../pages/AdminPage'

export default function AdminAuth() {
  const location = useLocation()
  const navigate = useNavigate()
  const [message, setMessage] = useState('Checking authentication...')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function ensureAuthenticated() {
      try {
        // If this is the Hosted UI callback path, complete the sign-in and go to /admin
        if (location.pathname.startsWith('/admin/callback')) {
          setMessage('Completing sign-in...')
          // Avoid triggering Identity Pool credentials exchange here
          navigate('/admin', { replace: true })
          return
        }

        // Already signed-in? then allow rendering the admin page content
        await getCurrentUser()
        setReady(true)
        setMessage('')
      } catch {
        // Not signed-in → start Hosted UI redirect flow (COGNITO IdP)
        setMessage('Redirecting to sign-in...')
        await signInWithRedirect()
      }
    }

    ensureAuthenticated()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  if (!ready) return <p>{message}</p>

  // Signed-in: render the actual Admin page component
  return <AdminPage />
}
