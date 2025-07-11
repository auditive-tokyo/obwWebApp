import React from 'react'

type Message = {
  text: string
  personal: boolean
  timestamp?: string
  loading?: boolean
}

type Props = {
  messages: Message[]
  input: string
  setInput: (val: string) => void
  handleInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  handleSend: () => void
  messagesEndRef: React.RefObject<HTMLDivElement | null>
}

const ChatInterfaceView: React.FC<Props> = ({
  messages,
  input,
  setInput,
  handleInputKeyDown,
  handleSend,
  messagesEndRef
}) => (
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

export default ChatInterfaceView