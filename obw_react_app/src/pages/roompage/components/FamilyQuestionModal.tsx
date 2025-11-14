import { getMessage } from "@/i18n/messages";

interface FamilyQuestionModalProps {
  isOpen: boolean;
  onResponse: (isFamily: boolean) => void;
}

export function FamilyQuestionModal({
  isOpen,
  onResponse,
}: FamilyQuestionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {getMessage("familyQuestionTitle")}
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          {getMessage("familyQuestionDescription")}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => onResponse(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {getMessage("no")}
          </button>
          <button
            type="button"
            onClick={() => onResponse(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {getMessage("yes")}
          </button>
        </div>
      </div>
    </div>
  );
}
