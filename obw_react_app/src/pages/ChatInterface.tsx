import React, { useState, useRef, useEffect } from 'react'
import { getTimestamp } from './chatInterface/utils'
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

  const handleSend = () => {
    if (input.trim() === '') return
    setMessages(prev => [
      ...prev,
      { text: input, personal: true, timestamp: getTimestamp() }
    ])
    setInput('')
    setTimeout(addFakeMessage, 1200 + Math.random() * 1000)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

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
    <>
      <div className="chat">
        <div className="chat-title">
          <figure className="avatar">
            <img src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/156381/profile/profile-80.jpg" alt="avatar" />
          </figure>
          <h1>Fabio Ottaviani</h1>
          <h2>Supah</h2>
        </div>
        <div className="messages">
          <div className="messages-content">
            {messages.map((msg, idx) =>
              msg.loading ? (
                <div key={idx} className="message loading new">
                  <figure className="avatar">
                    <img src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/156381/profile/profile-80.jpg" alt="avatar" />
                  </figure>
                  <span></span>
                </div>
              ) : (
                <div
                  key={idx}
                  className={`message${msg.personal ? ' message-personal' : ''} new`}
                >
                  {!msg.personal && (
                    <figure className="avatar">
                      <img src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/156381/profile/profile-80.jpg" alt="avatar" />
                    </figure>
                  )}
                  {msg.text}
                  {msg.timestamp && <div className="timestamp">{msg.timestamp}</div>}
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="message-box">
          <textarea
            className="message-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type message..."
          />
          <button
            type="submit"
            className="message-submit"
            onClick={handleSend}
          >
            Send
          </button>
        </div>
      </div>
      <div className="bg"></div>
    </>
  )
}

export default ChatInterface