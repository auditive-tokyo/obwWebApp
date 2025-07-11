import { Routes, Route } from 'react-router-dom'
import MainPage from './pages/MainPage'
import CheckinPage from './pages/CheckinPage'
import ErrorPage from './pages/ErrorPage'
import ChatInterface from './pages/ChatInterface'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/checkin" element={<CheckinPage />} />
      <Route path="/chat" element={<ChatInterface />} />
      <Route path="*" element={<ErrorPage />} />
    </Routes>
  )
}

export default App
