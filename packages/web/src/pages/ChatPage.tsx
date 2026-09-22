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

const SUGGESTIONS = [
  'Add a task to review the quarterly budget',
  'What should I do today?',
  'Mark the invoices task as done',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [traceSessionId, setTraceSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const { showToast } = useToast();

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
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
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
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort('timeout');
    }, 60000); // 60s orchestrator loop timeout

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
          showToast({ title: 'Rate Limited', message: 'Gemini API rate limit exceeded. Please wait a moment.', type: 'warning' });
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
          showToast({ title: 'Request Timeout', message: 'The orchestrator took too long to respond (>60s).', type: 'error' });
        } else {
          return; // Aborted by unmount, halt execution and prevent state updates
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

  function applySuggestion(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  return (
    <div className="chat-page">
      <div className="chat-container">
        <header className="chat-header">
          <h2 className="chat-title">Conversation</h2>
          <div className="chat-header-meta">
            <span className="status-flag" />
            <span>Orchestrator online</span>
          </div>
        </header>

        <div className="chat-messages">
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <h3 className="empty-state-title">What needs doing?</h3>
              <p className="empty-state-sub">
                Describe a task in plain language. Aether understands the request,
                plans the work, executes it against your task list, and reports
                back &mdash; every step is logged and auditable.
              </p>
              <div className="empty-state-hint">Try one of these</div>
              <div className="empty-prompts">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="empty-prompt" onClick={() => applySuggestion(s)}>
                    {s}
                  </button>
                ))}
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
          {loading && (
            <div className="working">
              <div className="msg-label">
                <span className="msg-name">Aether</span>
              </div>
              <div className="working-box">
                <span className="working-label">Understanding &middot; planning &middot; executing</span>
                <div className="working-bar" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe a task, or ask what's on the books&hellip;"
              rows={1}
              disabled={loading}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
          <div className="chat-input-hint">Enter &mdash; send &nbsp;&middot;&nbsp; Shift + Enter &mdash; new line</div>
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
