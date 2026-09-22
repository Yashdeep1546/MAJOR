interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  sessionId?: string;
  onViewTrace?: (sessionId: string) => void;
}

export default function ChatMessage({ role, content, timestamp, sessionId, onViewTrace }: ChatMessageProps) {
  return (
    <div className={`message ${role}`}>
      <div className="message-avatar-wrap">
        {role === 'assistant' ? (
          <img
            src="/avatar.png"
            alt="AETHER"
            className="message-avatar-img"
            onError={(e) => {
              // Fallback if image fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.classList.add('fallback-avatar');
            }}
          />
        ) : (
          <div className="message-avatar-user">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}
      </div>
      <div className="message-body">
        <div className="message-content">
          {content}
        </div>
        <div className="message-meta">
          {timestamp && <span className="message-time">{timestamp}</span>}
          {role === 'assistant' && sessionId && onViewTrace && (
            <button 
              className="trace-toggle" 
              onClick={() => onViewTrace(sessionId)}
              title="Inspect 6-state execution trace"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              View Trace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
