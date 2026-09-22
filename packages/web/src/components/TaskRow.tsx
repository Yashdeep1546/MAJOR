interface TaskRowProps {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export default function TaskRow({ title, description, status, priority, dueDate }: TaskRowProps) {
  const statusLabel = STATUS_LABELS[status] ?? status.replace('_', ' ');
  const priorityLabel = PRIORITY_LABELS[priority] ?? priority;
  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className={`task-row ${status.toLowerCase()}`}>
      <span className={`status-box ${status}`} aria-hidden="true" />
      <div className="task-cell-main">
        <span className="task-title">{title}</span>
        {description && <p className="task-desc">{description}</p>}
      </div>
      <span className={`task-priority ${priority}`}>
        <i className="swatch" aria-hidden="true" />
        {priorityLabel}
      </span>
      <span className="task-due">{dueDateStr ? `Due ${dueDateStr}` : '\u2014'}</span>
      <span className={`task-status ${status}`}>{statusLabel}</span>
    </div>
  );
}
