import { getMessage } from "@/i18n/messages";
import { BasicCheckInOutDate } from "@/pages/components/BasicCheckInOutDate";

interface DateEditorModalProps {
  isOpen: boolean;
  checkInDate: Date | null;
  setCheckInDate: (date: Date | null) => void;
  checkOutDate: Date | null;
  setCheckOutDate: (date: Date | null) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function DateEditorModal({
  isOpen,
  checkInDate,
  setCheckInDate,
  checkOutDate,
  setCheckOutDate,
  onSave,
  onCancel,
}: DateEditorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {getMessage("editRoomDates")}
        </h3>
        <div className="mb-4">
          <BasicCheckInOutDate
            checkInDate={checkInDate}
            setCheckInDate={setCheckInDate}
            checkOutDate={checkOutDate}
            setCheckOutDate={setCheckOutDate}
          />
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <p className="text-sm text-yellow-800">
            ⚠️ {getMessage("roomDateChangeWarning")}
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            {getMessage("cancel")}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {getMessage("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
