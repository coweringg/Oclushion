"use client";

import { useRef, useState, useCallback, useEffect } from "react";

import type { DemoMessage } from "./demo-types";
import { DEMO_LIMIT_KEY, DEMO_MAX_PROMPTS } from "./demo-types";

const MOCK_RESPONSES: Record<string, string> = {
  javascript:
    "I can see you're working with JavaScript/TypeScript. The code looks well-structured. Here are a few suggestions:\n\n1. Consider adding type definitions for the config object\n2. You might want to split the agents into separate files for better maintainability\n3. The security configuration looks solid",
  python:
    "Nice Python code! A few observations:\n\n1. Type hints would make this more maintainable\n2. Consider adding error handling with try/except blocks\n3. The function could benefit from async/await for I/O operations",
  default:
    "I've analyzed your code. Here's what I found:\n\n- The project structure follows best practices\n- Your configuration is clean and well-organized\n- The security policies are properly defined\n\nWhat would you like me to help you with next?",
};

function getPromptCount(): number {
  try {
    return Number.parseInt(localStorage.getItem(DEMO_LIMIT_KEY) ?? "0", 10);
  } catch {
    return 0;
  }
}

function incrementPromptCount(): number {
  const count = getPromptCount() + 1;
  try {
    localStorage.setItem(DEMO_LIMIT_KEY, String(count));
  } catch {}
  return count;
}

function getBotResponse(_input: string): string {
  const lower = _input.toLowerCase();
  if (lower.includes("javascript") || lower.includes("typescript") || lower.includes("react"))
    return MOCK_RESPONSES["javascript"]!;
  if (lower.includes("python") || lower.includes("django") || lower.includes("flask"))
    return MOCK_RESPONSES["python"]!;
  return MOCK_RESPONSES["default"]!;
}

export function DemoChat() {
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to the Oclushion demo! I'm your AI coding assistant. Ask me anything about your code, or just say hello to see how it works. *(This is a simulated demo — install the desktop app for the full experience.)*",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [promptCount, setPromptCount] = useState(0);
  const [isResponding, setIsResponding] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const count = getPromptCount();
    setPromptCount(count);
    if (count >= DEMO_MAX_PROMPTS) {
      setLimitReached(true);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isResponding || limitReached) return;

      const count = incrementPromptCount();
      setPromptCount(count);

      const userMsg: DemoMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsResponding(true);

      if (count >= DEMO_MAX_PROMPTS) {
        setLimitReached(true);
        setIsResponding(false);
        return;
      }

      setTimeout(() => {
        const botMsg: DemoMessage = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: getBotResponse(trimmed),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsResponding(false);
      }, 800 + Math.random() * 600);
    },
    [isResponding, limitReached],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const remaining = DEMO_MAX_PROMPTS - promptCount;

  return (
    <div className="demo-chat">
      <div className="demo-chat-header">
        <span className="demo-chat-title">AI Chat</span>
        <span className={`demo-chat-limit ${remaining <= 2 ? "low" : ""}`}>
          {limitReached ? "Limit reached" : `${remaining} / ${DEMO_MAX_PROMPTS} free`}
        </span>
      </div>

      <div className="demo-chat-messages" role="log" aria-live="polite">
        {messages.map((msg) => (
          <div key={msg.id} className={`demo-chat-msg ${msg.role}`}>
            <div className="demo-chat-msg-avatar">{msg.role === "user" ? "U" : "AI"}</div>
            <div className="demo-chat-msg-content">
              <div className="demo-chat-msg-role">{msg.role === "user" ? "You" : "Oclushion AI"}</div>
              <div className="demo-chat-msg-text">{msg.content}</div>
            </div>
          </div>
        ))}
        {isResponding && (
          <div className="demo-chat-msg assistant">
            <div className="demo-chat-msg-avatar">AI</div>
            <div className="demo-chat-msg-content">
              <div className="demo-chat-msg-role">Oclushion AI</div>
              <div className="demo-chat-thinking">
                <span className="demo-chat-dot" />
                <span className="demo-chat-dot" />
                <span className="demo-chat-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="demo-chat-input-row" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="demo-chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={limitReached ? "Free limit reached — install desktop for more" : "Ask me about your code..."}
          disabled={limitReached}
          aria-label="Chat message"
        />
        <button
          className="demo-chat-send"
          type="submit"
          disabled={!input.trim() || isResponding || limitReached}
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </div>
  );
}
