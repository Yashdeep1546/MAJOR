import { useState, useEffect, useRef, useCallback } from 'react';
import TaskCard from '../components/TaskCard';
import { useToast } from '../components/ToastContext';

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
  const [degraded, setDegraded] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState<number | null>(null);
  
  const { showToast } = useToast();
  
  const retryCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTasks = useCallback(async (manual = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const params = filter ? `?status=${filter}` : '';
    
    // 10s timeout to prevent infinite hanging requests
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      if (manual) {
        setRetrySeconds(null);
        if (timerRef.current) clearTimeout(timerRef.current);
      }
      
      const res = await fetch(`/api/tasks${params}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      setTasks(data);
      
      if (degraded) {
        showToast({ title: 'Connection Restored', message: 'Task polling has resumed successfully.', type: 'info' });
      }
      
      setDegraded(false);
      setLoading(false);
      retryCount.current = 0;
      setRetrySeconds(null);
      
      timerRef.current = setTimeout(() => fetchTasks(), 5000); // 5s poll interval
    } catch (err: any) {
      if (err.name === 'AbortError' && !manual && !timerRef.current) return;
      
      clearTimeout(timeoutId);
      setDegraded(true);
      setLoading(false);
      
      retryCount.current += 1;
      const baseDelay = Math.pow(2, retryCount.current);
      const jitter = Math.random() * 2; // Adds between 0.0 and 1.99s to prevent thundering herd
      const nextRetry = Math.min(30, Math.ceil(baseDelay + jitter)); // Hard cap exactly at 30s
      
      setRetrySeconds(nextRetry);
      
      if (retryCount.current === 1) {
        showToast({ title: 'Connection Lost', message: 'Task polling failed. Automatically retrying...', type: 'warning' });
      }
      
      timerRef.current = setTimeout(() => fetchTasks(), nextRetry * 1000);
    }
  }, [filter, showToast, degraded]);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
    
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchTasks]);
  
  useEffect(() => {
    if (retrySeconds === null || retrySeconds <= 0) return;
    const interval = setInterval(() => {
      setRetrySeconds(s => (s !== null && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [retrySeconds]);

  return (
    <div className="tasks-page">
      {degraded && (
        <div className="tasks-degraded-banner">
          <span className="degraded-text">
            ⚠️ Connection interrupted. Showing cached data. {retrySeconds ? `Retrying in ${retrySeconds}s...` : 'Retrying...'}
          </span>
          <button 
            onClick={() => fetchTasks(true)}
            className="degraded-retry-btn"
          >
            Retry now
          </button>
        </div>
      )}

      <div className="tasks-container" style={{ opacity: degraded ? 0.65 : 1 }}>
        <div className="tasks-header-card">
          <div className="tasks-title-area">
            <h2>Task Management</h2>
            <p className="tasks-subtitle">
              Persisted in PostgreSQL database • Controlled deterministically by AETHER 6-State Loop
            </p>
          </div>
          <div className="tasks-filter-group">
            {[
              { id: '', label: 'All Tasks' },
              { id: 'TODO', label: 'To Do' },
              { id: 'IN_PROGRESS', label: 'In Progress' },
              { id: 'DONE', label: 'Completed' }
            ].map((f) => (
              <button
                key={f.id}
                className={`task-filter-pill${filter === f.id ? ' active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && tasks.length === 0 ? (
          <div className="empty-state">
            <div className="loading-dots"><span /><span /><span /></div>
            <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading tasks from database...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No tasks found</h3>
            <p>Ask AETHER via Chat to create or manage your tasks dynamically.</p>
          </div>
        ) : (
          <div className="tasks-grid">
            {tasks.map((task) => (
              <TaskCard key={task.id} {...task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
