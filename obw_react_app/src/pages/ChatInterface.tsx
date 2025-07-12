import React, { useState, useEffect } from 'react'
import { getTimestamp, scrollToBottom } from './chatInterface/utils'
import { flushSync } from 'react-dom'
import ChatInterfaceView from './chatInterface/ChatInterfaceView'
import { fetchAIResponseStream } from './chatInterface/fetchAIResponse';
import './chatInterface/style.scss'

type Message = {
  text: string
  personal: boolean
  timestamp?: string
  loading?: boolean
}

const WELCOME_MESSAGES = {
  ja: "ようこそ！Osaka Bay Wheel WebAppへ。",
  en: "Welcome to Osaka Bay Wheel WebApp."
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [fakeIndex, setFakeIndex] = useState(0)

  useEffect(() => {
    scrollToBottom();
  }, [messages])

  useEffect(() => {
    const lang = document.documentElement.lang as 'ja' | 'en'
    setMessages([
      {
        text: WELCOME_MESSAGES[lang] || WELCOME_MESSAGES.en,
        personal: false,
        timestamp: getTimestamp()
      }
    ])
    setFakeIndex(1)
  }, [])

  const handleSendMessage = async () => {
    if (!input.trim()) {
      console.log("Input is empty, aborting send.");
      return;
    }

    const newUserMessage: Message = {
      text: input,
      personal: true,
      timestamp: getTimestamp(),
    };
    console.log("User message:", newUserMessage);

    flushSync(() => {
      setMessages(prev => [...prev, newUserMessage]);
    });
    setInput('');
    console.log("User message added. Current messages:", messages);

    // 考え中バブル追加
    flushSync(() => {
      setMessages(prev => [...prev, { text: '', personal: false, loading: true }]);
    });
    console.log("Thinking bubble added. Current messages:", messages);

    let aiText = "";
    await fetchAIResponseStream(input, "", [], (delta, isDone = false) => {
      console.log("Received delta:", delta, "isDone:", isDone);
      if (!isDone) {
        // deltaをその都度UIに反映
        aiText += delta;
        setMessages(prev => {
          // loadingバブルがなければ追加
          const hasLoading = prev.some(msg => msg.loading);
          if (!hasLoading) {
            return [...prev, { text: aiText, personal: false, loading: true }];
          }
          // loadingバブルのtextを更新
          return prev.map(msg =>
            msg.loading ? { ...msg, text: aiText } : msg
          );
        });
        console.log("Updated loading bubble text. aiText:", aiText);
      } else {
        // 最終レスポンスでloadingバブルを消してAIメッセージとして追加
        setMessages(prev => {
          const currentMessages = prev.filter(msg => !msg.loading);
          const result = [
            ...currentMessages,
            {
              text: delta,
              personal: false,
              timestamp: getTimestamp(),
            }
          ];
          console.log("AI message bubble added. Messages:", result);
          return result;
        });
      }
    });
    console.log("fetchAIResponseStream finished. Final aiText:", aiText);
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <ChatInterfaceView
      messages={messages}
      input={input}
      setInput={setInput}
      handleInputKeyDown={handleInputKeyDown}
      handleSend={handleSendMessage}
    />
  )
}

export default ChatInterface