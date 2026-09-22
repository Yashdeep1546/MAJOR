interface TaskCardProps {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
}

export default function TaskCard({ title, description, status, priority, dueDate }: TaskCardProps) {
  const statusLabel = status.replace('_', ' ');
  const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

  return (
    <div className={`task-card ${status.toLowerCase()}`}>
      <div className="task-card-header">
        <h4 className="task-title">{title}</h4>
        <span className={`task-priority-badge ${priority.toLowerCase()}`}>
          {priority}
        </span>
      </div>
      {description && <p className="task-description">{description}</p>}
      <div className="task-footer">
        <span className={`task-status-pill ${status.toLowerCase()}`}>
          <span className="status-bullet" />
          {statusLabel}
        </span>
        {dueDateStr && (
          <span className="task-due-date">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Due {dueDateStr}
          </span>
        )}
      </div>
    </div>
  );
}
