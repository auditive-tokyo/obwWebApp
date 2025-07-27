import { useState } from 'react';
import ChatInterface from './ChatInterface';
import { RoomProps } from './chatInterface/typeClass';

const ChatWidget = ({ roomId }: RoomProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="fixed right-6 bottom-6 z-60 bg-blue-600 text-white rounded-full px-4 py-2 shadow-lg"
        onClick={() => setOpen(prev => !prev)}
      >
        Ask AI
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
          <ChatInterface roomId={roomId} />
        </div>
      )}
    </>
  );
};

export default ChatWidget;