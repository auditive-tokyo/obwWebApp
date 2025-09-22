import React, { useState, useEffect, useRef } from 'react'
import { getTimestamp, scrollToBottom } from './chatInterface/utils'
import { flushSync } from 'react-dom'
import ChatInterfaceView from './chatInterface/ChatInterfaceView'
import { fetchAIResponseStream } from './chatInterface/fetchAIResponse';
import { Message, RoomProps } from './chatInterface/typeClass'
import './chatInterface/style.scss'

const WELCOME_MESSAGES = {
  ja: "ようこそ！Osaka Bay Wheel WebAppへ。",
  en: "Welcome to Osaka Bay Wheel WebApp."
}

const ChatInterface: React.FC<RoomProps> = ({ roomId, approved, currentLocation }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isComposing, setIsComposing] = useState(false);
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

    // AIストリーム受信時の更新（final時に images をトップレベルへ正規化）
    const handleStreamDelta = (
      payload: string | { assistant_response_text: string; reference_files?: string[]; images?: string[] },
      isDone: boolean = false
    ) => {
      setMessages(curr =>
        curr.map(m => {
          if (m.id !== aiMessageId) return m;
          if (typeof payload === 'string') {
            return { ...m, text: payload };
          }
          const next = {
            ...m,
            text: payload,
            loading: isDone ? false : m.loading,
            timestamp: isDone ? getTimestamp() : m.timestamp,
          };
          if (isDone && Array.isArray(payload.images)) {
            next.images = payload.images; // 画像URLを格納
          }
          return next;
        })
      );
    };

    // roomIdを使ってAIにリクエスト
    await fetchAIResponseStream(
      input,
      roomId,
      approved,
      currentLocation,
      handleStreamDelta
    );
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => setIsComposing(false);

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