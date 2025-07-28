import { Routes, Route, useLocation, matchPath } from 'react-router-dom'
import MainPage from './pages/MainPage'
import RoomPage from './pages/RoomPage'
import CheckinPage from './pages/CheckinPage'
import ErrorPage from './pages/ErrorPage'
import Header from './header/Header'
import ChatWidget from './components/ChatWidget'

const allowedRooms = ['201', '304']

function App() {
  const location = useLocation();
  const match = matchPath("/:roomId", location.pathname);
  const roomId = match?.params?.roomId;
  const isValidRoom = roomId && allowedRooms.includes(roomId);

  return (
    <>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header />
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route
            path=":roomId"
            element={isValidRoom ? <RoomPage /> : <ErrorPage />}
          />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
        {/* ルートがRoomPage以外のときだけグローバル用ChatWidgetを表示 */}
        {!location.pathname.match(/^\/\d+$/) && <ChatWidget roomId="" />}
      </div>
    </>
  )
}

export default App
