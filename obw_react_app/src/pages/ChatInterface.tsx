import React, { useState, useEffect } from 'react'
import { getTimestamp, scrollToBottom } from './chatInterface/utils'
import { flushSync } from 'react-dom'
import ChatInterfaceView from './chatInterface/ChatInterfaceView'
import './chatInterface/style.scss'

type Message = {
  text: string
  personal: boolean
  timestamp?: string
  loading?: boolean
}

const FAKE_MESSAGES = [
  "Hi there, I'm Fabio and you?",
  "Nice to meet you",
  "How are you?",
  "Not too bad, thanks",
  "What do you do?",
  "That's awesome",
  "Codepen is a nice place to stay",
  "I think you're a nice person",
  "Why do you think that?",
  "Can you explain?",
  "Anyway I've gotta go now",
  "It was a pleasure chat with you",
  "Time to make a new codepen",
  "Bye",
  ":)"
]

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [fakeIndex, setFakeIndex] = useState(0)

  useEffect(() => {
    scrollToBottom();
  }, [messages])

  useEffect(() => {
    // 初回は直接welcomeメッセージを追加
    setMessages([
      {
        text: FAKE_MESSAGES[0],
        personal: false,
        timestamp: getTimestamp()
      }
    ])
    setFakeIndex(1)
  }, [])

  const handleSendMessage = () => {
    if (!input.trim()) return

    // 1. ユーザーメッセージを追加して再レンダリング
    const newUserMessage: Message = {
      text: input,
      personal: true,
      timestamp: getTimestamp(),
    }
    // 1. flushSyncを使い、ユーザーメッセージの追加を同期的（即時）に実行し、再レンダリングを強制
    flushSync(() => {
      setMessages(prev => [...prev, newUserMessage])
    })
    setInput('')

    // 2. 次の処理を少し遅らせる
    setTimeout(() => {
      // 3. flushSyncを使い、考え中バブルの追加も同期的に実行
      flushSync(() => {
        setMessages(prev => [...prev, { text: '', personal: false, loading: true }])
      })

      // 4. AIからのレスポンスをシミュレート
      setTimeout(() => {
        // 5. 考え中バブルを削除し、最終的なレスポンスを追加して再レンダリング
        setMessages(prev => {
          const currentMessages = prev.filter(msg => !msg.loading)
          const newFakeMessage: Message = {
            text: FAKE_MESSAGES[fakeIndex % FAKE_MESSAGES.length],
            personal: false,
            timestamp: getTimestamp(),
          }
          return [...currentMessages, newFakeMessage]
        })
        setFakeIndex(prev => prev + 1)
      }, 1000 + Math.random() * 1000)
    }, 100) // ユーザーメッセージ表示後に少し間を置く（flushSyncを使うので短くてOK）
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