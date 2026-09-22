import { useState, useRef, useEffect } from 'react';
import ChatMessage from '../components/ChatMessage';
import TraceViewer from '../components/TraceViewer';
import { useToast } from '../components/ToastContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sessionId?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  
  const [traceSessionId, setTraceSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const { showToast } = useToast();

  const QUICK_SUGGESTIONS = [
    { label: 'Buy organic apples tomorrow', type: 'primary' },
    { label: 'Show my tasks', type: 'secondary' },
    { label: 'Review project priority', type: 'secondary' }
  ];

  // Track elapsed time during loading to show transparent slow API status
  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [loading]);

  // Load chat history from DB on mount
  useEffect(() => {
    setLoading(true);
    fetch(`/api/chat/recent`)
      .then(res => res.json())
      .then(data => {
        if (data && data.conversationId) {
          setConversationId(data.conversationId);
          setMessages(data.messages || []);
        }
      })
      .catch(err => {
        console.error('Failed to load chat history', err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort('unmount');
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(customText?: string) {
    const text = (customText ?? input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const controller = new AbortController();
    activeRequestRef.current = controller;
    
    let isTimeout = false;
    // 180s timeout for multi-step reasoning under free-tier 12.5s rate throttle
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort('timeout');
    }, 180000);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 429) {
          showToast({ title: 'Rate Limited', message: 'Gemini API rate limit exceeded. Backoff in progress, please retry shortly.', type: 'warning' });
        } else {
          showToast({ title: 'Server Error', message: `Backend failed to process request (${res.status})`, type: 'error' });
        }
        return;
      }

      const data = await res.json();

      if (!conversationId) setConversationId(data.conversationId);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sessionId: data.sessionId,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      activeRequestRef.current = null;
      setLoading(false);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        if (isTimeout) {
          showToast({ 
            title: 'Request Timeout', 
            message: 'The orchestrator took >180s due to API rate throttling. Please retry.', 
            type: 'error' 
          });
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: '⚠️ Request timed out after 180s. The multi-step reasoning chain exceeded the free-tier API rate limits. Please try again.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        } else {
          return; // Aborted by unmount
        }
      } else {
        showToast({ title: 'Network Error', message: 'Failed to connect to the AETHER server.', type: 'error' });
      }
      activeRequestRef.current = null;
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function insertEmoji(emoji: string) {
    setInput((prev) => prev + emoji);
    textareaRef.current?.focus();
  }

  return (
    <div className="chat-page">
      <div className="chat-container">
        
        {/* Curved Navy Header inspired by design mockup */}
        <header className="chat-header-wave">
          <div className="chat-header-content">
            <div className="chat-header-left">
              <div className="header-avatar-container">
                <img 
                  src="/avatar.png" 
                  alt="AETHER Avatar" 
                  className="header-avatar-img"
                />
                <span className="header-status-badge" title="Online" />
              </div>
              <div className="header-meta">
                <span className="header-chat-with">Chat with</span>
                <h2 className="header-bot-name">AETHER</h2>
                <div className="header-online-status">
                  <span className="status-indicator-dot" />
                  <span>We're online</span>
                </div>
              </div>
            </div>

            <div className="chat-header-actions">
              <button 
                className="header-action-btn"
                title="Options"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Options"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
              <button 
                className="header-action-btn"
                title="Minimize / Collapse"
                onClick={() => showToast({ title: 'AETHER Active', message: '6-state autonomous engine is running and ready.', type: 'info' })}
                aria-label="Minimize"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {menuOpen && (
                <div className="header-dropdown-menu">
                  <button 
                    onClick={() => {
                      setMessages([]);
                      setConversationId(null);
                      setMenuOpen(false);
                      showToast({ title: 'New Conversation', message: 'Started a fresh session.', type: 'info' });
                    }}
                  >
                    ✨ New Conversation
                  </button>
                  <button 
                    onClick={async () => {
                      setMessages([]);
                      setConversationId(null);
                      setMenuOpen(false);
                      try {
                        await fetch('/api/chat', { method: 'DELETE' });
                        showToast({ title: 'History Cleared', message: 'All chat history and audit traces wiped clean.', type: 'info' });
                      } catch (err) {
                        showToast({ title: 'Error', message: 'Failed to clear database history', type: 'error' });
                      }
                    }}
                  >
                    🗑️ Clear Full History
                  </button>
                  <button 
                    onClick={() => {
                      setMenuOpen(false);
                      showToast({ title: 'Engine Status', message: 'Dual-model routing with Gemini Flash + Reasoning active.', type: 'info' });
                    }}
                  >
                    ⚡ Engine Info
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Subtle Wave SVG Bottom Curve */}
          <div className="header-wave-svg-wrap">
            <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <path d="M0 0C240 32 480 48 720 48C960 48 1200 32 1440 0V48H0V0Z" fill="var(--bg-app)" />
            </svg>
          </div>
        </header>

        {/* Message Stream */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-welcome-card">
              <div className="welcome-avatar-wrap">
                <img src="/avatar.png" alt="AETHER" className="welcome-avatar-img" />
              </div>
              <div className="welcome-content">
                <h3>Hi there! Nice to see you 👋</h3>
                <p>
                  I'm <strong>AETHER</strong>, an autonomous AI assistant powered by a 6-state execution loop. 
                  I can schedule tasks, resolve priorities, track deadlines, and maintain deterministic database records.
                </p>
                <p className="welcome-subtext">What would you like to accomplish today?</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
              sessionId={msg.sessionId}
              onViewTrace={setTraceSessionId}
            />
          ))}

          {/* Quick Reply / Suggestion Chips from design mockup */}
          {(!loading && messages.length <= 4) && (
            <div className="quick-replies-container">
              {QUICK_SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  className={`quick-reply-btn ${item.type}`}
                  onClick={() => handleSend(item.label)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="message assistant">
              <div className="message-avatar-wrap">
                <img src="/avatar.png" alt="AETHER" className="message-avatar-img pulsing" />
              </div>
              <div className="message-body">
                <div className="message-content bot-typing-card">
                  <div className="loading-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  {elapsedSeconds >= 15 && (
                    <div className="loading-elapsed-text">
                      {elapsedSeconds >= 45 
                        ? `Executing multi-step reasoning and observing results... (${elapsedSeconds}s)`
                        : `Orchestrating multi-step execution across models (free-tier rate-throttled: ~12.5s/call)... (${elapsedSeconds}s)`
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area inspired by design mockup */}
        <div className="chat-input-area">
          <div className="chat-input-card">
            <textarea
              ref={textareaRef}
              className="chat-input-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your message..."
              rows={1}
              disabled={loading}
            />

            <div className="chat-input-bottom-row">
              <div className="input-attachments-group">
                <button 
                  type="button" 
                  className="input-tool-icon-btn" 
                  title="Emoji"
                  onClick={() => insertEmoji('😊 ')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </button>
                <button 
                  type="button" 
                  className="input-tool-icon-btn" 
                  title="Attach file / reference"
                  onClick={() => showToast({ title: 'Context Attachment', message: 'Drop task details or type naturally in the prompt.', type: 'info' })}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
              </div>

              <button
                className="chat-send-fab"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                title="Send message"
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>

      {traceSessionId && (
        <TraceViewer
          sessionId={traceSessionId}
          onClose={() => setTraceSessionId(null)}
        />
      )}
    </div>
  );
}
