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
  }, [filter, showToast]);

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
    <div className="tasks-page" style={{ position: 'relative' }}>
      {degraded && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--warning-bg)',
          borderBottom: '1px solid var(--warning)',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderRadius: 'var(--radius-md)'
        }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--warning)', fontWeight: 500 }}>
            ⚠️ Connection lost. Showing cached data. {retrySeconds ? `Retrying in ${retrySeconds}s...` : 'Retrying...'}
          </span>
          <button 
            onClick={() => fetchTasks(true)}
            style={{
              background: 'var(--warning)',
              color: 'var(--bg-root)',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform var(--duration-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Retry now
          </button>
        </div>
      )}

      <div style={{ opacity: degraded ? 0.6 : 1, transition: 'opacity var(--duration-std)' }}>
        <div className="tasks-header">
          <h2>Tasks</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['', 'TODO', 'IN_PROGRESS', 'DONE'].map((f) => (
              <button
                key={f}
                className={`sidebar-link${filter === f ? ' active' : ''}`}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  border: 'none',
                  background: filter === f ? 'var(--accent-bg)' : 'transparent',
                  color: filter === f ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
                onClick={() => setFilter(f)}
              >
                {f || 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading && tasks.length === 0 ? (
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
    </div>
  );
}
