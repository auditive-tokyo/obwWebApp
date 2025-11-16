import ChatWidget from "@/components/ChatWidget";
import { getMessage } from "@/i18n/messages";
import { ChatInstructionBox } from "./components/ChatInstructionBox";
import { useState } from "react";

function GeneralPage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              {getMessage("welcome")}
            </h1>
            <p className="text-gray-600 mb-6">
              {getMessage("facilityAddress")}
            </p>
            <div className="prose max-w-none">
              <p className="text-gray-800 leading-relaxed font-semibold text-lg">
                {getMessage("generalSupportPage")}
              </p>
              <p className="text-gray-700 leading-relaxed font-semibold text-md">
                {getMessage("generalPageDescription")}
              </p>
            </div>
          </div>

          {/* チャットインストラクションボックス */}
          <ChatInstructionBox
            hasApprovedGuest={false}
            isAfterCheckInTime={false}
            onToggleChat={() => setChatOpen(!chatOpen)}
          />
        </div>
      </div>

      {/* グローバルチャット (roomIdなし) */}
      <ChatWidget
        roomId=""
        approved={false}
        open={chatOpen}
        setOpen={setChatOpen}
      />
    </div>
  );
}

export default GeneralPage;
