import React, { useState, RefObject, useLayoutEffect, useRef } from "react";
import { getTimestamp } from "./chatInterface/utils";
import { flushSync } from "react-dom";
import ChatInterfaceView from "./chatInterface/ChatInterfaceView";
import { fetchAIResponseStream } from "./chatInterface/fetchAIResponse";
import { Message, RoomProps } from "./chatInterface/typeClass";
import "./chatInterface/style.scss";

type StreamPayload =
  | string
  | {
      assistant_response_text: string;
      reference_sources?: string[];
      images?: string[];
    };

/**
 * AIメッセージを更新するための純粋関数
 */
function updateAiMessage(
  message: Message,
  targetId: number,
  payload: StreamPayload,
  isDone: boolean,
): Message {
  if (message.id !== targetId) return message;

  if (typeof payload === "string") {
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

/**
 * メッセージ配列を更新する関数を生成
 */
function createMessageUpdater(
  aiMessageId: number,
  payload: StreamPayload,
  isDone: boolean,
) {
  return (messages: Message[]) =>
    messages.map((m) => updateAiMessage(m, aiMessageId, payload, isDone));
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
  nextId,
}) => {
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const scroll = () => {
      el.scrollTop = el.scrollHeight;
    };
    // rAF でレイアウト計算完了後にスクロール
    const rafId = requestAnimationFrame(scroll);
    // bounce アニメーション（500ms）完了後にも再スクロール
    const timerId = setTimeout(scroll, 550);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const newUserMessage: Message = {
      id: nextId.current.current++,
      text: input,
      personal: true,
      timestamp: getTimestamp(),
    };

    const aiMessageId = nextId.current.current++;
    const newAiMessage: Message = {
      id: aiMessageId,
      text: "",
      personal: false,
      loading: true,
    };

    flushSync(() => {
      setMessages((prev) => [...prev, newUserMessage, newAiMessage]);
    });
    setInput("");

    // スマホのキーボードを下げる
    inputRef.current?.blur();

    // AIストリーム受信時の更新（final時に images をトップレベルへ正規化）
    const handleStreamDelta = (
      payload: StreamPayload,
      isDone: boolean = false,
    ) => {
      setMessages(createMessageUpdater(aiMessageId, payload, isDone));
    };

    // roomIdを使ってAIにリクエスト
    await fetchAIResponseStream(input, roomId, approved, handleStreamDelta, {
      representativeName,
      representativeEmail,
      representativePhone,
      currentLocation,
      ...(checkInDate
        ? { checkInDate: checkInDate.toISOString().split("T")[0] }
        : {}),
      ...(checkOutDate
        ? { checkOutDate: checkOutDate.toISOString().split("T")[0] }
        : {}),
    });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
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
      messagesContainerRef={messagesContainerRef}
    />
  );
};

export default ChatInterface;
