import { NavLink } from 'react-router-dom';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-brand">
          <img src="/avatar.png" alt="AETHER" className="sidebar-brand-avatar" />
          <div className="sidebar-brand-text">
            <h1>AETHER</h1>
            <p>AI Assistant</p>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/chat" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Chat</span>
        </NavLink>
        <NavLink to="/tasks" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <path d="M9 11l3 3L22 4" />
          </svg>
          <span>Tasks</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-engine-badge">
          <span className="sidebar-engine-dot" />
          <div className="sidebar-engine-info">
            <span className="sidebar-engine-title">6-State Orchestrator</span>
            <span className="sidebar-engine-sub">Autonomous Loop</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
