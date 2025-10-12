import { matchPath, Route, Routes, useLocation } from 'react-router-dom'
import AdminAuth from './auth/AdminAuth'
import AdminLogout from './auth/AdminLogout'
import Auth from './auth/Auth'
import ChatWidget from './components/ChatWidget'
import Header from './header/Header'
import ErrorPage from './pages/ErrorPage'
import MainPage from './pages/MainPage'
import RoomPage from './pages/RoomPage'

// 2F〜8F 各フロア 01〜04号室を許可
const allowedRooms: string[] = Array.from({ length: 7 }, (_, floorIdx) =>
  Array.from({ length: 4 }, (_, roomIdx) =>
    `${floorIdx + 2}${String(roomIdx + 1).padStart(2, '0')}`
  )
).flat();

function App() {
  const location = useLocation();
  const match = matchPath("/:roomId", location.pathname);
  const roomId = match?.params?.roomId;
  const isValidRoom = roomId && allowedRooms.includes(roomId);

  // Admin用のroomId検証。/admin/:roomId や /admin/:roomId/:booking を許容する
  const adminMatch = matchPath("/admin/:roomId/*", location.pathname);
  const adminRoomId = adminMatch?.params?.roomId;
  const isValidAdminRoom = adminRoomId && allowedRooms.includes(adminRoomId);

  return (
    <>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header />
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/room/:roomId" element={<Auth />} />
          {/* Admin routes protected by Cognito Hosted UI */}
          <Route path="/admin" element={<AdminAuth />} />
          <Route
            path="/admin/:roomId"
            element={isValidAdminRoom ? <AdminAuth /> : <ErrorPage />}
          />
          <Route
            path="/admin/:roomId/:bookingId"
            element={isValidAdminRoom ? <AdminAuth /> : <ErrorPage />}
          />
          <Route path="/admin/callback" element={<AdminAuth />} />
          <Route path="/admin/logout" element={<AdminLogout />} />
          <Route
            path=":roomId"
            element={isValidRoom ? <RoomPage /> : <ErrorPage />}
          />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
        {/* ルートがRoomPage以外のときだけグローバル用ChatWidgetを表示 */}
        {!location.pathname.match(/^\/\d+$/) && <ChatWidget roomId="" approved={false} />}
      </div>
    </>
  )
}

export default App
