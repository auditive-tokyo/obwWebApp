import React, { useState, useEffect, useRef } from 'react'
import { getTimestamp, scrollToBottom } from './chatInterface/utils'
import { flushSync } from 'react-dom'
import ChatInterfaceView from './chatInterface/ChatInterfaceView'
import { fetchAIResponseStream } from './chatInterface/fetchAIResponse';
import { Message } from './chatInterface/typeClass'
import './chatInterface/style.scss'

const WELCOME_MESSAGES = {
  ja: "ようこそ！Osaka Bay Wheel WebAppへ。",
  en: "Welcome to Osaka Bay Wheel WebApp."
}

const BASIC_USER = "obw_testuser"; // TODO: あとで削除
const BASIC_PASS = "obw_testP@ss"; // TODO: あとで削除

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isComposing, setIsComposing] = useState(false);
  const [authed, setAuthed] = useState(false); // TODO: あとで削除
  const [user, setUser] = useState(''); // TODO: あとで削除
  const [pass, setPass] = useState(''); // TODO: あとで削除
  const nextId = useRef(0);

  useEffect(() => {
    scrollToBottom();
  }, [messages])

  useEffect(() => {
    const lang = document.documentElement.lang as 'ja' | 'en'
    setMessages([
      {
        id: nextId.current++,
        text: WELCOME_MESSAGES[lang] || WELCOME_MESSAGES.en,
        personal: false,
        timestamp: getTimestamp()
      }
    ])
  }, [])

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const newUserMessage: Message = {
      id: nextId.current++,
      text: input,
      personal: true,
      timestamp: getTimestamp(),
    };

    const aiMessageId = nextId.current++;
    const newAiMessage: Message = {
      id: aiMessageId,
      text: '',
      personal: false,
      loading: true
    };

    flushSync(() => {
      setMessages(prev => [...prev, newUserMessage, newAiMessage]);
    });
    setInput('');

    // TODO: filter_keysはpageのstate（部屋番号などが割り当てらてから定義する
    await fetchAIResponseStream(input, ["201", "common"], (delta, isDone = false) => {
      setMessages(prev => {
        // 考え中バブルを見つけて、そのテキストを更新する
        return prev.map(msg =>
          msg.id === aiMessageId
            ? { ...msg, text: delta, loading: !isDone, timestamp: isDone ? getTimestamp() : undefined }
            : msg
        );
      });
    });
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => setIsComposing(false);

// TODO: あとで削除
  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-xs">
          <h2 className="text-xl font-bold mb-6 text-center">認証が必要です</h2>
          <input
            type="text"
            placeholder="ユーザー名"
            value={user}
            onChange={e => setUser(e.target.value)}
            className="mb-4 px-4 py-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="password"
            placeholder="パスワード"
            value={pass}
            onChange={e => setPass(e.target.value)}
            className="mb-6 px-4 py-2 border rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={() => {
              if (user === BASIC_USER && pass === BASIC_PASS) setAuthed(true);
              else alert("認証失敗");
            }}
            className="w-full bg-blue-500 text-white font-semibold py-2 rounded hover:bg-blue-600 transition"
          >
            ログイン
          </button>
        </div>
      </div>
    );
  }
// TODO: ここまで削除

  return (
    <ChatInterfaceView
      messages={messages}
      input={input}
      setInput={setInput}
      handleInputKeyDown={handleInputKeyDown}
      handleSend={handleSendMessage}
      handleCompositionStart={handleCompositionStart}
      handleCompositionEnd={handleCompositionEnd}
    />
  )
}

export default ChatInterface