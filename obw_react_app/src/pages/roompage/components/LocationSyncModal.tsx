import { getMessage } from "@/i18n/messages";

interface LocationSyncModalProps {
  isOpen: boolean;
  hasCurrentLocation: boolean;
  onClose: () => void;
  onStatusRefreshOnly: () => void;
  onConfirm: () => void;
}

export function LocationSyncModal({
  isOpen,
  hasCurrentLocation,
  onClose,
  onStatusRefreshOnly,
  onConfirm,
}: LocationSyncModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {getMessage(
            hasCurrentLocation ? "locationResyncTitle" : "locationShareTitle"
          )}
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          {getMessage("statusUpdateMessage")}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {getMessage("cancel")}
          </button>
          <button
            type="button"
            onClick={onStatusRefreshOnly}
            className="px-4 py-2 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
          >
            {getMessage("updateStatusOnly")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {getMessage("shareLocation")}
          </button>
        </div>
      </div>
    </div>
  );
}
