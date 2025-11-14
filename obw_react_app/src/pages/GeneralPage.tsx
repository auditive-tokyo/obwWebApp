import ChatWidget from "../components/ChatWidget";
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
              〒552-0021 大阪府大阪市港区築港4-2-24
            </p>
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed">
                施設に関するご質問や、周辺情報についてお気軽にAIアシスタントにお尋ねください。
                チェックイン方法、アクセス情報、おすすめの観光スポットなど、様々なご質問にお答えします。
              </p>
            </div>
          </div>

          {/* チャットインストラクションボックス */}
          <ChatInstructionBox
            hasApprovedGuest={false}
            isAfterCheckInTime={false}
            onToggleChat={() => setChatOpen(!chatOpen)}
            customMessage="施設に関するご質問や、周辺情報についてお気軽にAIアシスタントにお尋ねください。"
          />
        </div>
      </div>

      {/* グローバルチャット (roomIdなし) */}
      <ChatWidget roomId="" approved={false} open={chatOpen} setOpen={setChatOpen} />
    </div>
  );
}

export default GeneralPage;
