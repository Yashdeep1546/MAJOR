import { useState, useEffect } from 'react';
import TaskCard from '../components/TaskCard';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    const params = filter ? `?status=${filter}` : '';
    fetch(`/api/tasks${params}`)
      .then((r) => r.json())
      .then((data) => { setTasks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <h2>Tasks</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['', 'TODO', 'IN_PROGRESS', 'DONE'].map((f) => (
            <button
              key={f}
              className={`sidebar-link${filter === f ? ' active' : ''}`}
              style={{ padding: '6px 14px', fontSize: '0.75rem' }}
              onClick={() => setFilter(f)}
            >
              {f || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No tasks yet — ask AETHER to create one via chat</p>
        </div>
      ) : (
        <div className="tasks-grid">
          {tasks.map((task) => (
            <TaskCard key={task.id} {...task} />
          ))}
        </div>
      )}
    </div>
  );
}
