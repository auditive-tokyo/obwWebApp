import React, { useState, RefObject, useEffect } from 'react'
import { getTimestamp, scrollToBottom } from './chatInterface/utils'
import { flushSync } from 'react-dom'
import ChatInterfaceView from './chatInterface/ChatInterfaceView'
import { fetchAIResponseStream } from './chatInterface/fetchAIResponse';
import { Message, RoomProps } from './chatInterface/typeClass'
import './chatInterface/style.scss'

interface ChatInterfaceProps extends RoomProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  nextId: RefObject<{ current: number }>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  roomId, 
  approved, 
  currentLocation, 
  messages, 
  setMessages, 
  nextId 
}) => {
  const [input, setInput] = useState('')
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    scrollToBottom();
  }, [messages])

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const newUserMessage: Message = {
      id: nextId.current!.current++,
      text: input,
      personal: true,
      timestamp: getTimestamp(),
    };

    const aiMessageId = nextId.current!.current++;
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