import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { Amplify } from 'aws-amplify'
import { amplifyConfig } from './amplify-config'
import { fetchAuthSession } from 'aws-amplify/auth'

Amplify.configure(amplifyConfig)

// セッション情報を表示
fetchAuthSession()
  .then(session => {
    console.log("現在のセッション (main.tsx):", session)
  })
  .catch(error => {
    console.error("セッション取得エラー (main.tsx):", error)
  })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/">
      <App />
    </BrowserRouter>
  </StrictMode>,
)
