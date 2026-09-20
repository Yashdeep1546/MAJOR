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
        <span className="task-title">{title}</span>
        <span className={`task-priority ${priority}`}>{priority}</span>
      </div>
      {description && <p className="task-description">{description}</p>}
      <div className="task-footer">
        <span className={`task-status ${status}`}>{statusLabel}</span>
        {dueDateStr && <span>Due {dueDateStr}</span>}
      </div>
    </div>
  );
}
