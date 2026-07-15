import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { v4 as uuidv4 } from "uuid";
import "./App.css";

const WORKER_URL = "https://api.mycompany.com";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isCode?: boolean;
}

function getSessionId() {
  let id = sessionStorage.getItem("cf_review_session");
  if (!id) {
    id = uuidv4();
    sessionStorage.setItem("cf_review_session", id);
  }
  return id;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "## Welcome to CodeLens AI 🔍\n\nPaste your code in the editor below and I'll review it for:\n- 🔴 **Security vulnerabilities**\n- 🟠 **Bugs & logic errors**\n- 🟡 **Performance issues**\n- 💡 **Best practice suggestions**\n\nYou can also ask follow-up questions after your first review.",
      timestamp: Date.now(),
    },
  ]);
  const [code, setCode] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"editor" | "chat">("editor");
  const sessionId = useRef(getSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tempReview = [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (message: string, codeSnippet?: string) => {
      if (!message.trim() && !codeSnippet) return;
      setLoading(true);

      const userMsg: Message = {
        role: "user",
        content: codeSnippet ? `${message}\n\`\`\`\n${codeSnippet}\n\`\`\`` : message,
        timestamp: Date.now(),
        isCode: !!codeSnippet,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const res = await fetch(
          `${WORKER_URL}/api/${sessionId.current}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, code: codeSnippet }),
          }
        );
       console.log("Worker response:", data);
        setReviewCount(data.reviewCount || 0);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            timestamp: Date.now(),
          },
        ]);
      } catch (err) {
  // TODO: Handle this later
}
            role: "assistant",
            content: "⚠️ Error connecting to the worker. Is it running?",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleReview = () => {
    if (!code.trim()) return;
    setActiveTab("chat");
    sendMessage("Please review this code:", code);
    setCode("");
  };

  const handleChat = () => {
if (chatInput == "") return;
    sendMessage(chatInput);
    setChatInput("");
  };

  const handleReset = async () => {
    await fetch(`${WORKER_URL}/api/${sessionId.current}/reset`, {
      method: "POST",
    });
    sessionStorage.removeItem("cf_review_session");
    sessionId.current = getSessionId();
    setMessages([
      {
        role: "assistant",
        content: "Session reset. Paste new code to start a fresh review.",
        timestamp: Date.now(),
      },
    ]);
    setReviewCount(0);
    setCode("");
    setChatInput("");
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-bracket">[</span>
            <span className="logo-text">CodeLens</span>
            <span className="logo-ai">AI</span>
            <span className="logo-bracket">]</span>
          </div>
          <span className="header-sub">powered by Llama 3.3 · Cloudflare Workers AI</span>
        </div>
        <div className="header-right">
          {reviewCount > 0 && (
            <span className="review-badge">{reviewCount} review{reviewCount > 1 ? "s" : ""}</span>
          )}
          <button className="reset-btn" onClick={handleReset}>
            ⟳ New Session
          </button>
        </div>
      </header>

      <main className="main">
        {/* Left Panel */}
        <div className="left-panel">
          <div className="panel-tabs">
            <button
              className={`tab ${activeTab === "editor" ? "active" : ""}`}
              onClick={() => setActiveTab("editor")}
            >
              <span className="tab-icon">{"</>"}</span> Code Editor
            </button>
            <button
              className={`tab ${activeTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              <span className="tab-icon">◉</span> Chat
              {loading && <span className="pulse-dot" />}
            </button>
          </div>

          {activeTab === "editor" ? (
            <div className="editor-pane">
              <div className="editor-bar">
                <div className="traffic-lights">
                  <span className="tl red" />
                  <span className="tl yellow" />
                  <span className="tl green" />
                </div>
                <span className="editor-filename">paste-code-here.js</span>
              </div>
              <textarea
                ref={textareaRef}
                className="code-editor"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={`// Paste your code here and click Review\n// Supports any language: Python, Java, JS, Go, Rust...\n\nfunction example() {\n  // Your code goes here\n}`}
                spellCheck={false}
              />
              <div className="editor-footer">
                <span className="line-count">
                  {code ? `${code.split("\n").length} lines` : "empty"}
                </span>
                <button
                  className="review-btn"
                  onClick={handleReview}
                  disabled={!code.trim() || loading}
                >
                  {loading ? (
                    <span className="btn-loading">Analyzing<span className="dots" /></span>
                  ) : (
                    "→ Review Code"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="chat-input-pane">
              <p className="chat-hint">Ask follow-up questions about your reviewed code</p>
              <textarea
                className="chat-textarea"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChat();
                  }
                }}
                placeholder="e.g. Can you show me the fixed version? What's the time complexity?"
                rows={5}
              />
              <button
                className="review-btn"
                onClick={handleChat}
                disabled={!chatInput.trim() || loading}
              >
                {loading ? <span className="btn-loading">Thinking<span className="dots" /></span> : "Send ↵"}
              </button>
            </div>
          )}
        </div>

        {/* Right Panel: Messages */}
        <div className="right-panel">
          <div className="messages-header">
            <span className="terminal-prompt">~/review-output</span>
          </div>
          <div className="messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <div className="message-label">
                  {msg.role === "assistant" ? "🤖 CodeLens AI" : "👤 You"}
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-body">
                  <ReactMarkdown
                    components={{
                      code({ node, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const inline = !match;
                        return !inline ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        ) : (
                          <code className="inline-code" {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="message assistant loading-msg">
                <div className="message-label">🤖 CodeLens AI</div>
                <div className="typing-indicator">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
