import { NavLink } from 'react-router-dom';

const SECTIONS = [
  { to: '/chat', index: '01', label: 'Conversation' },
  { to: '/tasks', index: '02', label: 'Tasks' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>AETHER</h1>
        <p>Task Operations &middot; Phase I</p>
      </div>

      <div className="sidebar-section-label">Workspace</div>
      <nav className="sidebar-nav">
        {SECTIONS.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-link-num">{s.index}</span>
            <span>{s.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-status">
          <span className="status-flag" />
          <span>All systems nominal</span>
        </div>
        <p className="sidebar-build">
          Build 0.1.0 &mdash; Phase I<br />
          Understand &rsaquo; Plan &rsaquo; Execute &rsaquo; Critique
        </p>
      </div>
    </aside>
  );
}
