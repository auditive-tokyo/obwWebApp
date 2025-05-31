import { Routes, Route, Navigate } from 'react-router-dom'
import CheckinPage from './pages/CheckinPage'
import ErrorPage from './pages/ErrorPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/checkin" />} />
      <Route path="/checkin" element={<CheckinPage />} />
      <Route path="*" element={<ErrorPage />} />
    </Routes>
  )
}

export default App
