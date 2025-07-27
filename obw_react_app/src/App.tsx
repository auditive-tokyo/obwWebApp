import { Routes, Route, useLocation, matchPath } from 'react-router-dom'
import MainPage from './pages/MainPage'
import RoomPage from './pages/RoomPage'
import CheckinPage from './pages/CheckinPage'
import ErrorPage from './pages/ErrorPage'
import Header from './header/Header'
import ChatWidget from './components/ChatWidget'

function App() {
  // ルートからroomIdを取得
  const location = useLocation();
  const match = matchPath("/:roomId", location.pathname);
  const roomId = match?.params?.roomId;

  return (
    <>
      {/* コンテンツは position: relative, zIndex: 1 で背景の上に表示 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header />
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path=":roomId" element={<RoomPage />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
        <ChatWidget roomId={roomId ?? ""} /> {/* roomIdを渡す */}
      </div>
    </>
  )
}

export default App
