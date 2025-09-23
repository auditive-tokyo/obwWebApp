import React from 'react'
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

// URLを自動的にリンクに変換する関数
const convertUrlsToLinks = (text: string): string => {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]()（）]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #4fc3f7; text-decoration: underline;">$1</a>');
};

// テキスト処理関数（改行 + URLリンク化）
const processText = (text: string): string => {
  return convertUrlsToLinks(text).replace(/\n/g, "<br />");
};

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
                <div
                  key={msg.id}
                  className={`message new ${!msg.text ? 'loading' : ''} ${msg.personal ? 'message-personal' : 'message-ai'}`}
                  data-testid={msg.personal ? 'user-msg-loading' : 'ai-msg-loading'}
                >
                  <figure className="avatar">
                    <img src="https://osakabaywheel.com/img/logo_color.svg" alt="avatar" />
                  </figure>
                  {msg.text
                    ? typeof msg.text === "object"
                      ? <span
                          dangerouslySetInnerHTML={{
                            __html:
                              msg.text.assistant_response_text
                                ? processText(msg.text.assistant_response_text)
                                : ""
                          }}
                        />
                      : <span dangerouslySetInnerHTML={{ __html: processText(String(msg.text)) }} />
                    : <span></span>}
                </div>
              ) : (
                <div
                  key={msg.id}
                  className={`message new ${msg.personal ? 'message-personal' : 'message-ai'}`}
                  data-testid={msg.personal ? 'user-msg' : 'ai-msg'}
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
                          __html: processText(msg.text.assistant_response_text)
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
                    <span dangerouslySetInnerHTML={{ __html: processText(String(msg.text)) }} />
                  )}
                  {/* 画像は msg.images（正規化済み）か、未正規化なら msg.text.images から表示 */}
                  {!msg.personal && (() => {
                    const imgs =
                      Array.isArray(msg.images) && msg.images.length > 0
                        ? msg.images
                        : (typeof msg.text === "object" &&
                           Array.isArray((msg.text as any).images) &&
                           (msg.text as any).images.length > 0
                           ? (msg.text as any).images
                           : []);
                    return imgs.length > 0 ? (
                      <div className="ai-images">
                        {imgs.map((url: string, i: number) => (
                          <img key={i} src={url} alt={`ai-${i}`} className="ai-inline-image" loading="lazy" />
                        ))}
                      </div>
                    ) : null;
                  })()}
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