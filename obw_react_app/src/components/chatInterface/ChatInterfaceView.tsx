import React from "react";
import { Message } from "./typeClass";

type Props = {
  messages: Message[];
  input: string;
  setInput: (val: string) => void;
  handleInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSend: () => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  messagesContainerRef?: React.RefObject<HTMLDivElement | null>;
};

const AVATAR_URL = "https://osakabaywheel.com/img/logo_color.svg";

// URLを自動的にリンクに変換する関数
const convertUrlsToLinks = (text: string): string => {
  // 先にマークダウンリンク [text](url) を処理
  let result = text.replaceAll(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #4fc3f7; text-decoration: underline;">$1</a>',
  );
  // 次にベアURLを処理（既にリンク化されたhref内のURLはスキップ）
  result = result.replaceAll(
    /(?<!href=")(https?:\/\/[^\s<>"{}|\\^`[\]()（）]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #4fc3f7; text-decoration: underline;">$1</a>',
  );
  return result;
};

// テキスト処理関数（改行 + URLリンク化）
const processText = (text: string): string => {
  return convertUrlsToLinks(text).replaceAll("\n", "<br />");
};

// 安全に msg.text から images を取り出すユーティリティ
function extractImages(text: unknown): string[] {
  if (typeof text === "object" && text !== null) {
    const t = text as Record<string, unknown>;
    const imgs = t.images;
    if (Array.isArray(imgs))
      return imgs.filter((i): i is string => typeof i === "string");
  }
  return [];
}

// テキストからHTML文字列を取得
function getProcessedHtml(text: Message["text"]): string {
  if (typeof text === "object" && text !== null) {
    return text.assistant_response_text
      ? processText(text.assistant_response_text)
      : "";
  }
  return processText(String(text));
}

// 画像配列を取得
function getMessageImages(msg: Message): string[] {
  if (Array.isArray(msg.images) && msg.images.length > 0) {
    return msg.images;
  }
  return extractImages(msg.text);
}

// リファレンスリンクコンポーネント
const ReferenceLinks: React.FC<{ sources: string[] }> = ({ sources }) => (
  <div className="reference-files">
    <strong>Reference(s):</strong>
    <ul>
      {sources.map((file) => {
        const isUrl = file.startsWith("https://") || file.startsWith("http://");
        return (
          <li key={file}>
            {isUrl ? (
              <a
                href={file}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#4fc3f7", textDecoration: "underline" }}
              >
                {file}
              </a>
            ) : (
              file
            )}
          </li>
        );
      })}
    </ul>
  </div>
);

// AI画像コンポーネント
const AiImages: React.FC<{ images: string[] }> = ({ images }) => (
  <div className="ai-images">
    {images.map((url) => (
      <img
        key={url}
        src={url}
        alt="ai-image"
        className="ai-inline-image"
        loading="lazy"
      />
    ))}
  </div>
);

// 統合メッセージアイテムコンポーネント
// loading→completed の遷移で DOM ノードを維持し、bounce アニメーションの再発動を防ぐ
const MessageItem: React.FC<{ msg: Message }> = ({ msg }) => {
  const isLoading = Boolean(msg.loading);
  const hasText = Boolean(msg.text);
  const images = msg.personal || isLoading ? [] : getMessageImages(msg);
  const hasReferences =
    !isLoading &&
    !msg.personal &&
    typeof msg.text === "object" &&
    msg.text?.reference_sources &&
    msg.text.reference_sources.length > 0;

  const className = [
    "message",
    "new",
    isLoading && !hasText ? "loading" : "",
    msg.personal ? "message-personal" : "message-ai",
  ]
    .filter(Boolean)
    .join(" ");

  let testId: string;
  if (msg.personal) {
    testId = isLoading ? "user-msg-loading" : "user-msg";
  } else {
    testId = isLoading ? "ai-msg-loading" : "ai-msg";
  }

  return (
    <div className={className} data-testid={testId}>
      {!msg.personal && (
        <figure className="avatar">
          <img src={AVATAR_URL} alt="avatar" />
        </figure>
      )}
      {hasText ? (
        <span
          dangerouslySetInnerHTML={{ __html: getProcessedHtml(msg.text) }}
        />
      ) : (
        <span></span>
      )}
      {hasReferences && typeof msg.text === "object" && (
        <ReferenceLinks sources={msg.text.reference_sources!} />
      )}
      {images.length > 0 && <AiImages images={images} />}
      {!isLoading && msg.timestamp && (
        <div className="timestamp">{msg.timestamp}</div>
      )}
    </div>
  );
};

const ChatInterfaceView: React.FC<Props> = ({
  messages,
  input,
  setInput,
  handleInputKeyDown,
  handleSend,
  handleCompositionStart,
  handleCompositionEnd,
  inputRef,
  messagesContainerRef,
}) => {
  return (
    <>
      <div className="chat">
        <div className="chat-title">
          <figure className="avatar">
            <img
              src="https://osakabaywheel.com/img/logo_color.svg"
              alt="avatar"
            />
          </figure>
          <h1>OSAKA BAY WHEEL AI</h1>
          <h2>OBW</h2>
        </div>
        <div className="messages" ref={messagesContainerRef}>
          <div className="messages-content">
            {messages.map((msg) => (
              <MessageItem key={msg.id} msg={msg} />
            ))}
          </div>
        </div>
        <div className="message-box">
          <textarea
            ref={inputRef}
            className="message-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="Type message..."
            enterKeyHint="send"
          />
          <button type="submit" className="message-submit" onClick={handleSend}>
            <img
              src="/paper-plane-svgrepo-com.svg"
              alt="Send"
              style={{ width: "24px", height: "24px" }}
            />
          </button>
        </div>
      </div>
      <div className="bg"></div>
    </>
  );
};

export default ChatInterfaceView;
