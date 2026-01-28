import React, { useState, RefObject, useEffect } from 'react'
import { getTimestamp, scrollToBottom } from './chatInterface/utils'
import { flushSync } from 'react-dom'
import ChatInterfaceView from './chatInterface/ChatInterfaceView'
import { fetchAIResponseStream } from './chatInterface/fetchAIResponse';
import { Message, RoomProps } from './chatInterface/typeClass'
import './chatInterface/style.scss'

type StreamPayload = string | { assistant_response_text: string; reference_sources?: string[]; images?: string[] };

/**
 * AIメッセージを更新するための純粋関数
 */
function updateAiMessage(message: Message, targetId: number, payload: StreamPayload, isDone: boolean): Message {
  if (message.id !== targetId) return message;
  
  if (typeof payload === 'string') {
    return { ...message, text: payload };
  }
  
  const updated: Message = {
    ...message,
    text: payload,
    loading: isDone ? false : message.loading,
    timestamp: isDone ? getTimestamp() : message.timestamp,
  };
  
  if (isDone && Array.isArray(payload.images)) {
    updated.images = payload.images;
  }
  
  return updated;
}

interface ChatInterfaceProps extends RoomProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  nextId: RefObject<{ current: number }>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  roomId, 
  approved, 
  representativeName,
  representativeEmail,
  representativePhone,
  currentLocation,
  checkInDate,
  checkOutDate,
  messages, 
  setMessages, 
  nextId 
}) => {
  const [input, setInput] = useState('')
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

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
    
    // スマホのキーボードを下げる
    inputRef.current?.blur();

    // AIストリーム受信時の更新（final時に images をトップレベルへ正規化）
    const handleStreamDelta = (payload: StreamPayload, isDone: boolean = false) => {
      setMessages(curr => curr.map(m => updateAiMessage(m, aiMessageId, payload, isDone)));
    };

    // roomIdを使ってAIにリクエスト
    await fetchAIResponseStream(
      input,
      roomId,
      approved,
      handleStreamDelta,
      {
        representativeName,
        representativeEmail,
        representativePhone,
        currentLocation,
        ...(checkInDate ? { checkInDate: checkInDate.toISOString().split('T')[0] } : {}),
        ...(checkOutDate ? { checkOutDate: checkOutDate.toISOString().split('T')[0] } : {}),
      }
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
      inputRef={inputRef}
    />
  )
}

export default ChatInterface