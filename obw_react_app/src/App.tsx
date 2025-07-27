import { Routes, Route } from 'react-router-dom'
import MainPage from './pages/MainPage'
import CheckinPage from './pages/CheckinPage'
import ErrorPage from './pages/ErrorPage'
import Header from './header/Header'
import ChatWidget from './components/ChatWidget'

function App() {
  return (
    <>
      {/* コンテンツは position: relative, zIndex: 1 で背景の上に表示 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header />
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
        <ChatWidget /> {/* 右下トグルチャットを追加 */}
      </div>
    </>
  )
}

export default App
