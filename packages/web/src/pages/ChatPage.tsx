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
  
  const [traceSessionId, setTraceSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const { showToast } = useToast();

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
    // Temporary workaround: 180s timeout for multi-step reasoning under free-tier 12.5s rate throttle
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

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <div className="status-dot" />
          <h2>AETHER Chat</h2>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🌀</div>
              <p>Ask AETHER anything — try "Create a task to review the project"</p>
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
            <div className="message assistant">
              <div className="message-avatar">A</div>
              <div className="message-body">
                <div className="message-content">
                  <div className="loading-dots"><span /><span /><span /></div>
                  {elapsedSeconds >= 15 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>
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

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              disabled={loading}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
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
