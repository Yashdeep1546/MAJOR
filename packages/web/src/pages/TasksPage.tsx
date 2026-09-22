import { useState, useEffect, useRef, useCallback } from 'react';
import TaskRow from '../components/TaskRow';
import { useToast } from '../components/ToastContext';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
];

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

  const openCount = tasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS').length;
  const doneCount = tasks.filter(t => t.status === 'DONE').length;

  return (
    <div className="tasks-page">
      {degraded && (
        <div className="degraded-banner">
          <span className="degraded-text">
            Connection lost &mdash; showing last known state
            {retrySeconds ? ` &middot; retrying in ${retrySeconds}s` : ' \u00b7 retrying'}
          </span>
          <button className="degraded-retry" onClick={() => fetchTasks(true)}>
            Retry now
          </button>
        </div>
      )}

      <div style={{ opacity: degraded ? 0.65 : 1, transition: 'opacity 120ms' }}>
        <div className="tasks-header">
          <div>
            <h2 className="tasks-title">Tasks</h2>
            <span className="tasks-count">
              {openCount} open &middot; {doneCount} done
            </span>
          </div>
          <div className="tasks-toolbar">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                className={`tab${filter === f.value ? ' active' : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && tasks.length === 0 ? (
          <div className="table-loading">
            <div className="working-bar" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="tasks-empty">
            <h3 className="tasks-empty-title">Nothing on the books.</h3>
            <p className="tasks-empty-sub">
              Tasks are created and updated from the Conversation &mdash; describe
              what needs doing and Aether will take it from there.
            </p>
          </div>
        ) : (
          <div className="task-table">
            <div className="task-table-head">
              <span className="num" aria-hidden="true" />
              <span>Task</span>
              <span>Priority</span>
              <span>Due</span>
              <span>Status</span>
            </div>
            {tasks.map((task) => (
              <TaskRow key={task.id} {...task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
