interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  sessionId?: string;
  onViewTrace?: (sessionId: string) => void;
}

export default function ChatMessage({ role, content, timestamp, sessionId, onViewTrace }: ChatMessageProps) {
  return (
    <div className={`msg ${role}`}>
      <div className="msg-label">
        <span className="msg-name">{role === 'user' ? 'You' : 'Aether'}</span>
        {timestamp && <span className="msg-time">{timestamp}</span>}
      </div>
      <div className="msg-content">{content}</div>
      {role === 'assistant' && sessionId && onViewTrace && (
        <div className="msg-actions">
          <button className="trace-toggle" onClick={() => onViewTrace(sessionId)}>
            View execution trace
          </button>
        </div>
      )}
    </div>
  );
}
