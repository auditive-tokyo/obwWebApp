import { useState } from "react"
import DatePicker from "react-datepicker"
import './BasicCheckInOutDate.css'
import { getMessage } from '@/i18n/messages'

type Props = {
  checkInDate: Date | null
  setCheckInDate: (date: Date | null) => void
  checkOutDate: Date | null
  setCheckOutDate: (date: Date | null) => void
}

// JST正午の日付を作成するヘルパー関数
const createJSTDate = (date: Date | null): Date | null => {
  if (!date) return null
  // 選択された日付をJST正午に設定（タイムゾーン問題を回避）
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  return new Date(year, month, day, 12, 0, 0, 0) // ローカルタイムの正午
}

// JST表示用のヘルパー関数
const formatJSTDate = (date: Date | null): string => {
  if (!date) return '未選択'
  return date.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  })
}

export function BasicCheckInOutDate({
  checkInDate,
  setCheckInDate,
  checkOutDate,
  setCheckOutDate
}: Props) {
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)

  const handleDateChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates
    // JST正午に統一して設定
    setCheckInDate(createJSTDate(start))
    setCheckOutDate(createJSTDate(end))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {getMessage("checkInOutDate")}<span className="text-red-500">*</span>
      </label>
      <button
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left"
        onClick={() => setCalendarModalOpen(true)}
      >
        {checkInDate && checkOutDate
          ? `${formatJSTDate(checkInDate)} 〜 ${formatJSTDate(checkOutDate)}`
          : getMessage("selectCheckInOutDate")}
      </button>

      {calendarModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 mx-auto shadow-2xl flex flex-col items-center" style={{ width: 'fit-content', minWidth: '320px' }}>
            <DatePicker
              selected={checkInDate}
              onChange={handleDateChange}
              startDate={checkInDate}
              endDate={checkOutDate}
              selectsRange
              inline
            />
            <div className="flex space-x-4 mt-2 text-sm text-gray-700">
              <div>
                {getMessage("checkInDate")}: {formatJSTDate(checkInDate)}
              </div>
              <div>
                {getMessage("checkOutDate")}: {formatJSTDate(checkOutDate)}
              </div>
            </div>
            <div className="mt-6 text-right">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setCalendarModalOpen(false)}
              >
                {getMessage("close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}