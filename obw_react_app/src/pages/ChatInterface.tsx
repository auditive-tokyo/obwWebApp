import React, { useState, useRef, useEffect } from 'react'
import { getTimestamp } from './chatInterface/utils'
import { handleSend, handleInputKeyDown } from './chatInterface/messageHandlers'
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const addFakeMessage = (customIndex?: number) => {
    setMessages(prev => [
      ...prev,
      { text: '', personal: false, loading: true }
    ])
    setTimeout(() => {
      setMessages(prev => {
        const msgs = prev.filter(msg => !msg.loading)
        // customIndexが指定されていればそれを使う
        const idx = typeof customIndex === 'number' ? customIndex : fakeIndex
        return [
          ...msgs,
          {
            text: FAKE_MESSAGES[idx % FAKE_MESSAGES.length],
            personal: false,
            timestamp: getTimestamp()
          }
        ]
      })
      // customIndexが指定されていればfakeIndexを更新しない
      if (typeof customIndex !== 'number') {
        setFakeIndex(idx => idx + 1)
      }
    }, 1000 + Math.random() * 1000)
  }

  return (
    <ChatInterfaceView
      messages={messages}
      input={input}
      setInput={setInput}
      handleInputKeyDown={e => handleInputKeyDown(e, () => handleSend(input, setMessages, setInput, addFakeMessage))}
      handleSend={() => handleSend(input, setMessages, setInput, addFakeMessage)}
      messagesEndRef={messagesEndRef}
    />
  )
}

export default ChatInterface