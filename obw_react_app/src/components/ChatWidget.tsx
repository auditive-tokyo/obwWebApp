import { useState } from 'react';
import ChatInterface from './ChatInterface';
import { RoomProps } from './chatInterface/typeClass';

const ChatWidget = ({ roomId, approved }: RoomProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="fixed right-6 bottom-6 z-60 bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 text-black rounded-full px-4 py-1 shadow-lg inline-flex items-center gap-2 border border-teal-200"
        onClick={() => setOpen(prev => !prev)}
      >
        <span className="leading-none">Ask anything to OBW AI Bot!</span>
        <img src="/icons8-bot-64.png" alt="Bot" className="w-8 h-8" />
      </button>
      {open && (
        <div
          className="fixed right-2 bottom-20 z-50 bg-white rounded-lg shadow-2xl"
          style={{
            width: '90vw',
            maxWidth: 350,
            height: '70vh',
            maxHeight: 500,
            overflow: 'hidden',
          }}
        >
          <ChatInterface roomId={roomId} approved={approved} />
        </div>
      )}
    </>
  );
};

export default ChatWidget;