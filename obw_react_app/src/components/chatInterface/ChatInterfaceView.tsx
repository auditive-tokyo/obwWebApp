import { Message } from './typeClass'

type Props = {
  messages: Message[]
  input: string
  setInput: (val: string) => void
  handleInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  handleSend: () => void
  handleCompositionStart: () => void
  handleCompositionEnd: () => void
}

const ChatInterfaceView: React.FC<Props> = ({
  messages,
  input,
  setInput,
  handleInputKeyDown,
  handleSend,
  handleCompositionStart,
  handleCompositionEnd,
}) => {
  return (
    <>
      <div className="chat">
        <div className="chat-title">
          <figure className="avatar">
            <img src="https://osakabaywheel.com/img/logo_color.svg" alt="avatar" />
          </figure>
          <h1>OSAKA BAY WHEEL AI</h1>
          <h2>OBW</h2>
        </div>
        <div className="messages">
          <div className="messages-content">
            {messages.map((msg) =>
              msg.loading ? (
                <div key={msg.id} className={`message new ${!msg.text ? 'loading' : ''}`}>
                  <figure className="avatar">
                    <img src="https://osakabaywheel.com/img/logo_color.svg" alt="avatar" />
                  </figure>
                  {msg.text
                    ? typeof msg.text === "object"
                      ? <span
                          dangerouslySetInnerHTML={{
                            __html:
                              msg.text.assistant_response_text
                                ? msg.text.assistant_response_text.replace(/\n/g, "<br />")
                                : ""
                          }}
                        />
                      : <span dangerouslySetInnerHTML={{ __html: String(msg.text).replace(/\n/g, "<br />") }} />
                    : <span></span>}
                </div>
              ) : (
                <div
                  key={msg.id}
                  className={`message${msg.personal ? ' message-personal' : ''} new`}
                >
                  {!msg.personal && (
                    <figure className="avatar">
                      <img src="https://osakabaywheel.com/img/logo_color.svg" alt="avatar" />
                    </figure>
                  )}
                  {typeof msg.text === "object" ? (
                    <>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: msg.text.assistant_response_text.replace(/\n/g, "<br />")
                        }}
                      />
                      {msg.text.reference_files && msg.text.reference_files.length > 0 && (
                        <div className="reference-files">
                          <strong>Reference(s):</strong>
                          <ul>
                            {msg.text.reference_files.map((file, idx) => (
                              <li key={idx}>{file}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <span dangerouslySetInnerHTML={{ __html: String(msg.text).replace(/\n/g, "<br />") }} />
                  )}
                  {msg.timestamp && <div className="timestamp">{msg.timestamp}</div>}
                </div>
              )
            )}
          </div>
        </div>
        <div className="message-box">
          <textarea
            className="message-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="Type message..."
            enterKeyHint="send"
          />
          <button
            type="submit"
            className="message-submit"
            onClick={handleSend}
          >
            <img
              src="/paper-plane-svgrepo-com.svg"
              alt="Send"
              style={{ width: '24px', height: '24px' }}
            />
          </button>
        </div>
      </div>
      <div className="bg"></div>
    </>
  );
}

export default ChatInterfaceView