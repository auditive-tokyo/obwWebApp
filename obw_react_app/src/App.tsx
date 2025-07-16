import { Routes, Route } from 'react-router-dom'
import MainPage from './pages/MainPage'
import CheckinPage from './pages/CheckinPage'
import ErrorPage from './pages/ErrorPage'
import ChatInterface from './pages/ChatInterface'
import Header from './header/Header'

function App() {
  return (
    <>
      {/* 背景は position: fixed で全体に表示 */}
      <div
        className="bg"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
        }}
      ></div>
      {/* コンテンツは position: relative, zIndex: 1 で背景の上に表示 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header />
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="/chat" element={<ChatInterface />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </div>
    </>
  )
}

export default App
