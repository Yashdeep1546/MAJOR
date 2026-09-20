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
      <div className="message-avatar">
        {role === 'user' ? 'U' : 'A'}
      </div>
      <div className="message-body">
        <div className="message-content">{content}</div>
        <div className="message-meta">
          {timestamp && <span className="message-time">{timestamp}</span>}
          {role === 'assistant' && sessionId && onViewTrace && (
            <button className="trace-toggle" onClick={() => onViewTrace(sessionId)}>
              ◉ View Trace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
