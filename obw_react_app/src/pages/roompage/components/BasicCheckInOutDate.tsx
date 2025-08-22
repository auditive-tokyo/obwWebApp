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

export function BasicCheckInOutDate({
  checkInDate,
  setCheckInDate,
  checkOutDate,
  setCheckOutDate
}: Props) {
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)

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
          ? `${checkInDate.toLocaleDateString()} 〜 ${checkOutDate.toLocaleDateString()}`
          : getMessage("selectCheckInOutDate")}
      </button>

      {calendarModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 mx-auto shadow-2xl flex flex-col items-center" style={{ width: 'fit-content', minWidth: '320px' }}>
            <DatePicker
              selected={checkInDate}
              onChange={(dates) => {
                const [start, end] = dates as [Date | null, Date | null]
                setCheckInDate(start)
                setCheckOutDate(end)
              }}
              startDate={checkInDate}
              endDate={checkOutDate}
              selectsRange
              inline
            />
            <div className="flex space-x-4 mt-2 text-sm text-gray-700">
              <div>
                {getMessage("checkInDate")}: {checkInDate ? checkInDate.toLocaleDateString() : '未選択'}
              </div>
              <div>
                {getMessage("checkOutDate")}: {checkOutDate ? checkOutDate.toLocaleDateString() : '未選択'}
              </div>
            </div>
            <div className="mt-6 text-right">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setCalendarModalOpen(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}