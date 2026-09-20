import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type ToastType = 'info' | 'warning' | 'error';

interface ToastOptions {
  title: string;
  message?: string;
  type?: ToastType;
}

interface Toast extends ToastOptions {
  id: string;
  visible: boolean;
  paused: boolean;
  timeLeft: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastUpdateRef = useRef<number>(Date.now());

  const showToast = useCallback((options: ToastOptions) => {
    setToasts((prev) => [
      ...prev,
      {
        ...options,
        id: crypto.randomUUID(),
        visible: true,
        paused: false,
        timeLeft: 5000,
        type: options.type || 'info',
      }
    ]);
  }, []);

  // Timer loop
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      setToasts((prev) => {
        let changed = false;
        
        // Find which toasts are currently "active" (first 4 visible)
        const activeIds = new Set(
          prev.filter(t => t.visible).slice(0, 4).map(t => t.id)
        );

        const next = prev.map((t) => {
          // Only decrement time if it's visible AND in the active slot AND not paused
          if (t.paused || !t.visible || !activeIds.has(t.id)) return t;
          changed = true;
          return { ...t, timeLeft: Math.max(0, t.timeLeft - delta) };
        });

        // Hide expired
        const withVisibility = next.map((t) => {
          if (t.visible && t.timeLeft <= 0) {
            changed = true;
            return { ...t, visible: false };
          }
          return t;
        });

        if (changed) return withVisibility;
        return prev;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Cleanup invisible toasts
  useEffect(() => {
    const hiddenToasts = toasts.filter(t => !t.visible);
    if (hiddenToasts.length > 0) {
      const timeout = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.visible));
      }, 200); // 150ms animation + buffer
      return () => clearTimeout(timeout);
    }
  }, [toasts]);

  const setPaused = (id: string, paused: boolean) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, paused } : t));
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
  };

  const visibleToasts = toasts.filter(t => t.visible);
  const activeToasts = visibleToasts.slice(0, 4);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {activeToasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type} ${t.visible ? '' : 'toast-exit'}`}
            onMouseEnter={() => setPaused(t.id, true)}
            onMouseLeave={() => setPaused(t.id, false)}
            onClick={() => removeToast(t.id)}
          >
            <div className="toast-title">{t.title}</div>
            {t.message && <div className="toast-message">{t.message}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
