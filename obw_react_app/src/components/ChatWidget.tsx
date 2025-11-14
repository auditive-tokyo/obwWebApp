import { useState, useRef } from "react";
import ChatInterface from "./ChatInterface";
import { RoomProps } from "./chatInterface/typeClass";
import { Message } from "./chatInterface/typeClass";
import { getTimestamp } from "./chatInterface/utils";

const WELCOME_MESSAGES = {
  ja: "ようこそ！Osaka Bay Wheel WebAppへ。",
  en: "Welcome to Osaka Bay Wheel WebApp.",
};

const ChatWidget = ({
  roomId,
  approved,
  representativeName,
  representativeEmail,
  representativePhone,
  currentLocation,
  checkInDate,
  checkOutDate,
  open: externalOpen,
  setOpen: externalSetOpen,
}: RoomProps & {
  open?: boolean;
  setOpen?: (open: boolean) => void;
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    // 初期化時にウェルカムメッセージを設定
    const lang = document.documentElement.lang as "ja" | "en";
    return [
      {
        id: 0,
        text: WELCOME_MESSAGES[lang] || WELCOME_MESSAGES.en,
        personal: false,
        timestamp: getTimestamp(),
      },
    ];
  });
  const nextId = useRef({ current: 1 }); // オブジェクトでラップ

  // 外部からopenが渡された場合はそれを使用、なければ内部state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalSetOpen || setInternalOpen;

  return (
    <>
      <button
        className="fixed right-6 bottom-6 z-60 bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 text-black rounded-full px-4 py-1 shadow-lg inline-flex items-center gap-2 border border-teal-200"
        onClick={() => setOpen(!open)}
      >
        <span className="leading-none">Ask anything to OBW AI Bot!</span>
        <img src="/icons8-bot-64.png" alt="Bot" className="w-8 h-8" />
      </button>
      {open && (
        <div
          className="fixed right-2 bottom-20 z-50 bg-white rounded-lg shadow-2xl"
          style={{
            width: "90vw",
            maxWidth: 350,
            height: "70vh",
            maxHeight: 500,
            overflow: "hidden",
          }}
        >
          <ChatInterface
            roomId={roomId}
            approved={approved}
            representativeName={representativeName}
            representativeEmail={representativeEmail}
            representativePhone={representativePhone}
            currentLocation={currentLocation}
            checkInDate={checkInDate}
            checkOutDate={checkOutDate}
            messages={messages}
            setMessages={setMessages}
            nextId={nextId}
          />
        </div>
      )}
    </>
  );
};

export default ChatWidget;
