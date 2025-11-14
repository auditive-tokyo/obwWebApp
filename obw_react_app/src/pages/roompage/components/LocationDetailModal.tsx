import { getMessage } from "@/i18n/messages";

interface LocationDetailModalProps {
  isOpen: boolean;
  location: string | null;
  onClose: () => void;
}

export function LocationDetailModal({
  isOpen,
  location,
  onClose,
}: LocationDetailModalProps) {
  if (!isOpen || !location) return null;

  const [address, timestamp] = location.split("@");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {getMessage("locationInfo")}
        </h3>
        <p className="text-sm text-gray-700 mb-6 break-words">{address}</p>
        <div className="text-xs text-gray-500 mb-4">
          {getMessage("updatedAt")}: {timestamp}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {getMessage("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
